import type {
  EvaluationResult,
  Issue,
  LayoutObject,
  LayoutPlan,
  LocalSide,
  Rect,
  Severity,
} from '../../models/types';
import { calculateSeating } from '../seating/calculateSeating';
import {
  getDistanceBetweenRects,
  getDoorClearanceRect,
  getDoorRect,
  getIntersectionArea,
  getObjectRect,
  getRectArea,
  getRoomRect,
  getSideGap,
  isRectInside,
  rectanglesIntersect,
  rotateLocalSide,
} from '../geometry/rect';
import { calculateScore } from './score';
import { getObjectZoneFit, getZoneAreaByType } from '../zoning/analyzeZones';

const createIssue = (
  issue: Omit<Issue, 'id'>,
  index: number,
): Issue => ({
  ...issue,
  id: `${issue.code}-${index}`,
});

const severityFromGap = (
  gap: number,
  required: number,
  warningThreshold = 150,
): Severity => {
  if (gap >= required) {
    return 'ok';
  }

  if (required - gap <= warningThreshold) {
    return 'warning';
  }

  return 'ng';
};

const severityFromDistance = (
  distance: number,
  target: number,
  tolerance: number,
): Severity => {
  if (distance <= target) {
    return 'ok';
  }
  if (distance <= target + tolerance) {
    return 'warning';
  }
  return 'ng';
};

const getOtherRects = (objects: LayoutObject[], currentId: string) =>
  objects
    .filter((object) => object.id !== currentId)
    .map((object) => getObjectRect(object));

const evaluateSideGap = (
  object: LayoutObject,
  localSide: LocalSide,
  required: number,
  title: Issue['title'],
  code: Issue['code'],
  descriptionPrefix: string,
  roomRect: Rect,
  objects: LayoutObject[],
) => {
  const side = rotateLocalSide(localSide, object.rotation);
  const gap = getSideGap(
    getObjectRect(object),
    side,
    getOtherRects(objects, object.id),
    roomRect,
  );
  const severity = severityFromGap(gap, required);

  if (severity === 'ok') {
    return null;
  }

  return {
    severity,
    code,
    title,
    description: `${descriptionPrefix} ${Math.max(gap, 0)}mm / 必要 ${required}mm`,
    objectIds: [object.id],
  } as Omit<Issue, 'id'>;
};

export const evaluatePlan = (
  plan: LayoutPlan,
  settings: {
    minCorridorWidth: number;
    chairClearance: number;
    doorClearance: number;
    meetingEntryClearance: number;
    receptionServiceDistance: number;
    commonAreaClearance: number;
  },
): EvaluationResult => {
  const roomRect = getRoomRect(plan.room);
  const issues: Issue[] = [];
  const corridorGaps: number[] = [];
  const objectRects = plan.objects.map((object) => ({
    object,
    rect: getObjectRect(object),
  }));

  for (const [index, object] of plan.objects.entries()) {
    const rect = getObjectRect(object);

    if (!isRectInside(rect, roomRect)) {
      issues.push(
        createIssue(
          {
            severity: 'ng',
            code: 'OUT_OF_ROOM',
            title: '部屋外にはみ出しています',
            description: `${object.name} が部屋境界を超えています。`,
            objectIds: [object.id],
          },
          index,
        ),
      );
    }

    const corridorSides = object.metadata.localCorridorSides ?? [];
    for (const localSide of corridorSides) {
      const side = rotateLocalSide(localSide, object.rotation);
      corridorGaps.push(
        getSideGap(rect, side, getOtherRects(plan.objects, object.id), roomRect),
      );
      const issue = evaluateSideGap(
        object,
        localSide,
        settings.minCorridorWidth,
        '通路幅不足',
        'CORRIDOR',
        `${object.name} の通路有効幅が不足しています。`,
        roomRect,
        plan.objects,
      );
      if (issue) {
        issues.push(createIssue(issue, issues.length));
      }
    }

    const chairSides = object.metadata.localChairSides ?? [];
    for (const localSide of chairSides) {
      const issue = evaluateSideGap(
        object,
        localSide,
        settings.chairClearance,
        '椅子引き代不足',
        'CHAIR_CLEARANCE',
        `${object.name} の椅子引き代が不足しています。`,
        roomRect,
        plan.objects,
      );
      if (issue) {
        issues.push(createIssue(issue, issues.length));
      }
    }

    if (
      object.metadata.frontOperationSide &&
      typeof object.metadata.frontOperationDepth === 'number'
    ) {
      const side = rotateLocalSide(
        object.metadata.frontOperationSide,
        object.rotation,
      );
      const gap = getSideGap(rect, side, getOtherRects(plan.objects, object.id), roomRect);
      const severity = severityFromGap(gap, object.metadata.frontOperationDepth, 200);
      if (severity !== 'ok') {
        issues.push(
          createIssue(
            {
              severity,
              code: 'COPY_OPERATION',
              title: 'コピー機前の操作余白不足',
              description: `${object.name} 前の操作余白が ${Math.max(gap, 0)}mm です。`,
              objectIds: [object.id],
            },
            issues.length,
          ),
        );
      }
    }

    if (
      object.metadata.waitingAreaSide &&
      typeof object.metadata.waitingAreaDepth === 'number' &&
      object.category === 'reception'
    ) {
      const side = rotateLocalSide(
        object.metadata.waitingAreaSide,
        object.rotation,
      );
      const gap = getSideGap(rect, side, getOtherRects(plan.objects, object.id), roomRect);
      const severity = severityFromGap(gap, object.metadata.waitingAreaDepth, 250);
      if (severity !== 'ok') {
        issues.push(
          createIssue(
            {
              severity,
              code: 'RECEPTION_WAITING',
              title: '受付前滞留帯不足',
              description: `${object.name} 前の滞留帯が ${Math.max(gap, 0)}mm です。`,
              objectIds: [object.id],
            },
            issues.length,
          ),
        );
      }
    }

    if (object.category === 'meeting') {
      const entrySides = object.metadata.meetingEntrySides ?? object.metadata.localCorridorSides ?? [];
      const entryGaps = entrySides.map((localSide) =>
        getSideGap(
          rect,
          rotateLocalSide(localSide, object.rotation),
          getOtherRects(plan.objects, object.id),
          roomRect,
        ),
      );
      const bestGap = entryGaps.length > 0 ? Math.max(...entryGaps) : 0;
      const severity = severityFromGap(bestGap, settings.meetingEntryClearance, 200);
      if (severity !== 'ok') {
        issues.push(
          createIssue(
            {
              severity,
              code: 'MEETING_ENTRY',
              title: '会議出入口前が混雑しています',
              description: `${object.name} の出入口確保幅が ${Math.max(bestGap, 0)}mm です。`,
              objectIds: [object.id],
            },
            issues.length,
          ),
        );
      }
    }

    if (object.category === 'support' || object.category === 'lounge') {
      const supportSides = object.metadata.localCorridorSides ?? ['bottom'];
      const bestGap = supportSides.reduce((current, localSide) => {
        const gap = getSideGap(
          rect,
          rotateLocalSide(localSide, object.rotation),
          getOtherRects(plan.objects, object.id),
          roomRect,
        );
        return Math.max(current, gap);
      }, 0);
      const severity = severityFromGap(bestGap, settings.commonAreaClearance, 200);
      if (severity !== 'ok') {
        issues.push(
          createIssue(
            {
              severity,
              code: 'COMMON_USABILITY',
              title: '共用部の使いやすさが不足しています',
              description: `${object.name} 周辺の有効幅が ${Math.max(bestGap, 0)}mm です。`,
              objectIds: [object.id],
            },
            issues.length,
          ),
        );
      }
    }
  }

  for (let left = 0; left < objectRects.length; left += 1) {
    for (let right = left + 1; right < objectRects.length; right += 1) {
      const leftObject = objectRects[left]!;
      const rightObject = objectRects[right]!;
      if (rectanglesIntersect(leftObject.rect, rightObject.rect)) {
        issues.push(
          createIssue(
            {
              severity: 'ng',
              code: 'OVERLAP',
              title: 'オブジェクトが重なっています',
              description: `${leftObject.object.name} と ${rightObject.object.name} が干渉しています。`,
              objectIds: [leftObject.object.id, rightObject.object.id],
            },
            issues.length,
          ),
        );
      }
    }
  }

  for (const door of plan.room.doors) {
    const doorRect = getDoorRect(door, plan.room);
    const clearanceRect = getDoorClearanceRect(door, plan.room, settings.doorClearance);
    const blocked = objectRects.filter(({ rect }) => rectanglesIntersect(rect, clearanceRect));
    if (blocked.length > 0) {
      issues.push(
        createIssue(
          {
            severity: blocked.some(({ rect }) => rectanglesIntersect(rect, doorRect))
              ? 'ng'
              : 'warning',
            code: 'DOOR_BLOCKED',
            title: '扉前が塞がれています',
            description: `${door.name} 前のクリアランスに ${blocked
              .map(({ object }) => object.name)
              .join(' / ')} がかかっています。`,
            objectIds: [`door:${door.id}`, ...blocked.map(({ object }) => object.id)],
          },
          issues.length,
        ),
      );
    }
  }

  const receptionObjects = objectRects.filter(({ object }) => object.category === 'reception');
  if (plan.room.doors.length > 0 && receptionObjects.length > 0) {
    const minReceptionDistance = Math.min(
      ...plan.room.doors.flatMap((door) =>
        receptionObjects.map(({ rect }) =>
          getDistanceBetweenRects(
            getDoorClearanceRect(door, plan.room, settings.doorClearance),
            rect,
          ),
        ),
      ),
    );
    const severity = severityFromDistance(
      minReceptionDistance,
      settings.receptionServiceDistance,
      1200,
    );
    if (severity !== 'ok') {
      issues.push(
        createIssue(
          {
            severity,
            code: 'VISITOR_FLOW',
            title: '来客対応しやすさに改善余地があります',
            description: `入口から受付までの距離が約 ${Math.round(minReceptionDistance)}mm です。`,
            objectIds: receptionObjects.map(({ object }) => object.id),
          },
          issues.length,
        ),
      );
    }
  } else if (plan.objects.length >= 4) {
    issues.push(
      createIssue(
        {
          severity: 'warning',
          code: 'VISITOR_FLOW',
          title: '来客導線の評価情報が不足しています',
          description: '出入口または受付が未設定のため、来客導線を十分に評価できません。',
          objectIds: [],
        },
        issues.length,
      ),
    );
  }

  const zoneFitIssues = plan.objects
    .map((object) => ({
      object,
      fit: getObjectZoneFit(object, plan.zones),
    }))
    .filter(({ fit, object }) => object.metadata.preferredZoneTypes?.length && fit < 0.35);

  if (plan.zones.length === 0 && plan.objects.length >= 4) {
    issues.push(
      createIssue(
        {
          severity: 'warning',
          code: 'ZONE_BALANCE',
          title: 'ゾーニングが未設定です',
          description: 'ゾーンがないため、部門配置や来客導線の検討がしづらい状態です。',
          objectIds: [],
        },
        issues.length,
      ),
    );
  } else if (zoneFitIssues.length > 0) {
    issues.push(
      createIssue(
        {
          severity: 'warning',
          code: 'ZONE_BALANCE',
          title: 'ゾーンと配置の整合に偏りがあります',
          description: `${zoneFitIssues
            .slice(0, 4)
            .map(({ object }) => object.name)
            .join(' / ')} が推奨ゾーンから外れています。`,
          objectIds: zoneFitIssues.map(({ object }) => object.id),
        },
        issues.length,
      ),
    );
  }

  const occupiedAreaRatio =
    objectRects.reduce((sum, { rect }) => sum + rect.width * rect.height, 0) /
    (plan.room.width * plan.room.height);
  const pressureSeverity =
    occupiedAreaRatio > 0.72 ? 'ng' : occupiedAreaRatio > 0.58 ? 'warning' : 'ok';
  if (pressureSeverity !== 'ok') {
    issues.push(
      createIssue(
        {
          severity: pressureSeverity,
          code: 'PRESSURE',
          title: '圧迫感が高めです',
          description: `占有率が ${(occupiedAreaRatio * 100).toFixed(1)}% です。`,
          objectIds: [],
        },
        issues.length,
      ),
    );
  }

  const { totalSeats, meetingSeats } = calculateSeating(plan.objects);
  const zoneArea = getZoneAreaByType(plan.zones);
  const sharedAreaRatio =
    ((zoneArea.support + zoneArea.lounge + zoneArea.reception + zoneArea.circulation) /
      Math.max(1, getRectArea(roomRect))) *
    100;
  const pressureIndex = Number((occupiedAreaRatio * 100 + Math.max(0, 20 - sharedAreaRatio)).toFixed(1));
  const score = calculateScore(issues);

  return {
    issues,
    metrics: {
      totalSeats,
      meetingSeats,
      occupiedAreaRatio: Number((occupiedAreaRatio * 100).toFixed(1)),
      minCorridorWidth:
        corridorGaps.length > 0 ? Math.max(0, Math.min(...corridorGaps)) : plan.room.width,
      warningCount: issues.filter((issue) => issue.severity === 'warning').length,
      ngCount: issues.filter((issue) => issue.severity === 'ng').length,
      score,
      zoneCount: plan.zones.length,
      sharedAreaRatio: Number(sharedAreaRatio.toFixed(1)),
      pressureIndex,
    },
  };
};
