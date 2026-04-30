import type {
  EvaluationResult,
  Issue,
  IssueSeverity,
  LayoutObject,
  LayoutPlan,
  ProjectSettings,
  Rect,
} from "../../models/types";
import {
  aisleGap,
  expandRect,
  isOutOfRoom,
  objectAABB,
  rectsOverlap,
} from "../geometry/rect";
import { meetingSeats, occupancyRatio, totalSeats } from "../seating";

/** 簡易判定。MVP優先度A中心 + 一部B。 */
export function evaluate(plan: LayoutPlan, settings: ProjectSettings): EvaluationResult {
  const issues: Issue[] = [];
  const minAisle = settings.minAisleWidth;

  // 1. 部屋外はみ出し / 重なり / 椅子引き代不足
  const aabbs = plan.objects.map((o) => ({ obj: o, rect: objectAABB(o) }));

  for (const { obj, rect } of aabbs) {
    if (isOutOfRoom(rect, plan.room)) {
      issues.push({
        id: `${obj.id}-oob`,
        objectId: obj.id,
        rule: "out-of-room",
        severity: "ng",
        message: `${obj.label} が部屋外にはみ出しています`,
      });
    }
  }

  // 2. オブジェクト重なり (柱と扉は構造扱いで重なり警告対象外)
  for (let i = 0; i < aabbs.length; i++) {
    for (let j = i + 1; j < aabbs.length; j++) {
      const a = aabbs[i];
      const b = aabbs[j];
      if (rectsOverlap(a.rect, b.rect)) {
        issues.push({
          id: `${a.obj.id}-${b.obj.id}-overlap`,
          objectId: a.obj.id,
          rule: "overlap",
          severity: "ng",
          message: `${a.obj.label} と ${b.obj.label} が重なっています`,
        });
      }
    }
  }

  // 3. 通路幅不足 (椅子引き代込み拡張矩形での隙間判定)
  let observedMinAisle = Infinity;
  for (let i = 0; i < aabbs.length; i++) {
    for (let j = i + 1; j < aabbs.length; j++) {
      const a = aabbs[i];
      const b = aabbs[j];
      const aExp = expandRect(a.rect, a.obj.chairClearance ?? 0);
      const bExp = expandRect(b.rect, b.obj.chairClearance ?? 0);
      const gx = aisleGap(aExp, bExp, "x");
      const gy = aisleGap(aExp, bExp, "y");
      const g = Math.min(gx, gy);
      if (Number.isFinite(g)) {
        observedMinAisle = Math.min(observedMinAisle, g);
        if (g < minAisle) {
          issues.push({
            id: `${a.obj.id}-${b.obj.id}-aisle`,
            objectId: a.obj.id,
            rule: "aisle-narrow",
            severity: g < minAisle * 0.6 ? "ng" : "warn",
            message: `${a.obj.label} と ${b.obj.label} 間の通路幅 ${Math.round(g)}mm が基準 ${minAisle}mm を下回ります`,
          });
        }
      }
    }
  }

  // 4. 扉前塞ぎ / 操作スペース不足 (frontClearance を使用)
  for (const { obj, rect } of aabbs) {
    const front = obj.frontClearance ?? 0;
    if (front <= 0) continue;
    const frontRect = frontZone(obj, rect, front);
    for (const other of aabbs) {
      if (other.obj.id === obj.id) continue;
      if (rectsOverlap(frontRect, other.rect)) {
        const sev: IssueSeverity = obj.kind === "door" ? "ng" : "warn";
        issues.push({
          id: `${obj.id}-${other.obj.id}-frontblocked`,
          objectId: obj.id,
          rule: "front-blocked",
          severity: sev,
          message: `${obj.label} の前面 ${front}mm が ${other.obj.label} に塞がれています`,
        });
      }
    }
  }

  const warnCount = issues.filter((i) => i.severity === "warn").length;
  const ngCount = issues.filter((i) => i.severity === "ng").length;

  const score = computeScore({
    occupancy: occupancyRatio(plan),
    warnCount,
    ngCount,
  });

  return {
    totalSeats: totalSeats(plan),
    meetingSeats: meetingSeats(plan),
    occupancyRatio: occupancyRatio(plan),
    minAisleWidth: Number.isFinite(observedMinAisle) ? observedMinAisle : 0,
    warnCount,
    ngCount,
    score,
    issues,
  };
}

/** 前面ゾーン矩形（回転を考慮し、向きの "前" を仮定。MVPは下方向を前とする。
 *  rotation 0 -> 下方向, 90 -> 右, 180 -> 上, 270 -> 左 */
function frontZone(obj: LayoutObject, aabb: Rect, depth: number): Rect {
  switch (obj.rotation) {
    case 0:
      return { x: aabb.x, y: aabb.y + aabb.height, width: aabb.width, height: depth };
    case 90:
      return { x: aabb.x + aabb.width, y: aabb.y, width: depth, height: aabb.height };
    case 180:
      return { x: aabb.x, y: aabb.y - depth, width: aabb.width, height: depth };
    case 270:
      return { x: aabb.x - depth, y: aabb.y, width: depth, height: aabb.height };
  }
}

interface ScoreInput {
  occupancy: number;
  warnCount: number;
  ngCount: number;
}

/** MVPスコア: 100 - 各種ペナルティ。0以上にクランプ。 */
export function computeScore({ occupancy, warnCount, ngCount }: ScoreInput): number {
  let score = 100;
  // 占有率は 0.4 ~ 0.6 が理想帯。外れるほど減点
  const ideal = 0.5;
  const deviation = Math.abs(occupancy - ideal);
  score -= deviation * 80;
  // warning / ng のペナルティ
  score -= warnCount * 3;
  score -= ngCount * 8;
  return Math.max(0, Math.round(score));
}
