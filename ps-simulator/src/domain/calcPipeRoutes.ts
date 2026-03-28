import type { Fixture, PipeRoute, PipeType, Point } from "./types";
import { fixturePipeMap } from "./rules/pipeSpecs";

/** 設備の中心座標を取得 */
function getCenter(f: Fixture): Point {
  return { x: f.x + f.w / 2, y: f.y + f.h / 2 };
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
 * 2つのL字ルート（水平→垂直 / 垂直→水平）のうち短い方を返す。
 * マンハッタン距離なのでどちらも同じ長さだが、ルート形状は異なる。
 */
function buildRoute(from: Point, to: Point): Point[] {
  // 水平→垂直
  return [from, { x: to.x, y: from.y }, to];
}

/**
 * 全設備から最寄りPSへの配管ルートを一括計算する。
 */
export function calcPipeRoutes(fixtures: Fixture[]): PipeRoute[] {
  const psList = fixtures.filter((f) => f.type === "ps");
  const equipment = fixtures.filter((f) => f.type !== "ps");
  const routes: PipeRoute[] = [];

  for (const eq of equipment) {
    const ps = findNearestPs(eq, psList);
    if (!ps) continue;

    const pipeTypes = fixturePipeMap[eq.type as keyof typeof fixturePipeMap];
    if (!pipeTypes) continue;

    const from = getCenter(eq);
    const to = getCenter(ps);
    const points = buildRoute(from, to);
    const lengthMm = manhattan(from, to);

    for (const pipeType of pipeTypes) {
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
