import type { Fixture, PipeRoute, PipeType, Point } from "./types";
import { structuralFixtureTypes } from "./types";
import { fixturePipeMap } from "./rules/pipeSpecs";
import { fixtureDrainSpec } from "./rules/fixtureDefaults";

/** 設備の中心座標を取得 */
function getCenter(f: Fixture): Point {
  return { x: f.x + f.w / 2, y: f.y + f.h / 2 };
}

/**
 * 設備の排水溝の絶対座標を取得。
 * drainOffsetMm が設定されていればそれを使い、未設定なら fixtureDrainSpec の比率で決定する。
 * 排水溝が存在しない設備は中心座標を返す。
 */
function getDrainPosition(f: Fixture): Point {
  const drain = fixtureDrainSpec[f.type];
  if (!drain) return getCenter(f);
  const localX = f.drainOffsetMm ? f.drainOffsetMm.x : f.w * drain.ratioX;
  const localY = f.drainOffsetMm ? f.drainOffsetMm.y : f.h * drain.ratioY;
  return { x: f.x + localX, y: f.y + localY };
}

/** マンハッタン距離 */
function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** 最寄りのPSを見つける */
function findNearestPs(fixture: Fixture, psList: Fixture[]): Fixture | null {
  if (psList.length === 0) return null;
  const fc = getCenter(fixture);
  let nearest = psList[0];
  let minDist = manhattan(fc, getCenter(nearest));
  for (let i = 1; i < psList.length; i++) {
    const d = manhattan(fc, getCenter(psList[i]));
    if (d < minDist) {
      minDist = d;
      nearest = psList[i];
    }
  }
  return nearest;
}

/**
 * 2つのL字ルート（水平→垂直 / 垂直→水平）を生成し、
 * より短い方（障害物がないので同距離だが形状が異なる）を選択する。
 * 管種ごとに異なるルートを割り当てて視認性を向上させる。
 */
function buildRoute(
  from: Point,
  to: Point,
  variant: "h-first" | "v-first"
): Point[] {
  if (variant === "h-first") {
    // 水平→垂直
    return [from, { x: to.x, y: from.y }, to];
  } else {
    // 垂直→水平
    return [from, { x: from.x, y: to.y }, to];
  }
}

/** 排水系の管種 */
const drainPipes = new Set<PipeType>(["soil", "waste", "vent"]);

/**
 * 全設備から最寄りPSへの配管ルートを一括計算する。
 * 排水系(soil/waste/vent)は排水溝〇から開始、給水系(cold/hot/gas)は設備中心から開始する。
 * 排水系は水平→垂直、給水系は垂直→水平の経路でルートを分離し、配管の重なりを抑える。
 */
export function calcPipeRoutes(fixtures: Fixture[]): PipeRoute[] {
  const psList = fixtures.filter((f) => f.type === "ps");
  // PS本体・構造系（柱/梁/壁）はルート計算対象外
  const equipment = fixtures.filter(
    (f) => f.type !== "ps" && !structuralFixtureTypes.has(f.type)
  );
  const routes: PipeRoute[] = [];

  for (const eq of equipment) {
    const ps = findNearestPs(eq, psList);
    if (!ps) continue;

    const pipeTypes = fixturePipeMap[eq.type as keyof typeof fixturePipeMap];
    if (!pipeTypes) continue;

    // 給水系の出発点 = 設備中心、排水系の出発点 = 排水溝
    const supplyFrom = getCenter(eq);
    const drainFrom = getDrainPosition(eq);
    const to = getCenter(ps);

    for (const pipeType of pipeTypes) {
      const isDrain = drainPipes.has(pipeType as PipeType);
      const from = isDrain ? drainFrom : supplyFrom;
      const variant = isDrain ? "h-first" : "v-first";
      const points = buildRoute(from, to, variant);
      const lengthMm = manhattan(from, to);

      routes.push({
        fixtureId: eq.id,
        psId: ps.id,
        pipeType: pipeType as PipeType,
        lengthMm,
        points,
      });
    }
  }

  return routes;
}
