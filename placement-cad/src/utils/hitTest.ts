import type {
  Shape, Point,
  SiteShape, BuildingShape, RoadShape, CompassShape, DimensionShape,
} from '../types/drawing';
import { computeDimensionGeometry } from './dimensions';
import { buildingWorldToLocal } from './buildingGeometry';

// 線分と点の最短距離 (mm)
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return Math.hypot(p.x - px, p.y - py);
}

// 点がポリゴン内部にあるか（レイキャスト法）
export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect =
      (yi > p.y) !== (yj > p.y) &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ===== 個別ヒットテスト =====
export const hitTestSite = (p: Point, s: SiteShape) =>
  pointInPolygon(p, s.points);

export function hitTestBuilding(p: Point, b: BuildingShape): boolean {
  // クリック点を建物のローカル(未回転)フレームへ戻して矩形内判定。
  // rotation の方向と未指定時の高速パスは buildingWorldToLocal が担う。
  const lp = buildingWorldToLocal(b, p);
  return (
    lp.x >= b.origin.x &&
    lp.x <= b.origin.x + b.width &&
    lp.y >= b.origin.y &&
    lp.y <= b.origin.y + b.depth
  );
}

export function hitTestRoad(p: Point, r: RoadShape, toleranceMM = 0): boolean {
  for (let i = 0; i < r.centerLine.length - 1; i++) {
    const d = distanceToSegment(p, r.centerLine[i], r.centerLine[i + 1]);
    if (d <= r.width / 2 + toleranceMM) return true;
  }
  return false;
}

export const hitTestCompass = (p: Point, c: CompassShape) =>
  Math.hypot(p.x - c.center.x, p.y - c.center.y) <= c.radius;

export function hitTestDimension(p: Point, d: DimensionShape, toleranceMM: number): boolean {
  // 描画と一致する寸法線（offset 後の本線）と、補助線 2 本をクリック対象にする。
  // 元の start→end (実測対象) は線として描画されないので判定対象から除外する。
  const g = computeDimensionGeometry(d.start, d.end, d.offset);
  if (distanceToSegment(p, g.offStart, g.offEnd) <= toleranceMM) return true;
  if (distanceToSegment(p, g.start,    g.offStart) <= toleranceMM) return true;
  if (distanceToSegment(p, g.end,      g.offEnd)   <= toleranceMM) return true;
  return false;
}

// ===== 統合ヒットテスト =====
// 手前にあるべき小さな図形（建物・方位）を優先、最後に敷地・道路。
export function hitTest(
  p: Point,
  shapes: Shape[],
  toleranceMM = 200,
): Shape | null {
  // 1. 建物・方位（小さめ・前面扱い）
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (s.type === 'building' && hitTestBuilding(p, s)) return s;
    if (s.type === 'compass' && hitTestCompass(p, s)) return s;
  }
  // 2. 道路（線状図形）
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (s.type === 'road' && hitTestRoad(p, s, toleranceMM)) return s;
  }
  // 3. 寸法（線にスナップ）
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (s.type === 'dimension' && hitTestDimension(p, s, toleranceMM)) return s;
  }
  // 4. 敷地（最後 = 背面扱い）
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (s.type === 'site' && hitTestSite(p, s)) return s;
  }
  return null;
}
