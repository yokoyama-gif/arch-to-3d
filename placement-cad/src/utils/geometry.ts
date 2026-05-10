import type { Point } from '../types/drawing';

// 2点間距離 (mm)
export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

// 多角形の符号付き面積 (mm^2)。CCW なら正。
export function signedArea(points: Point[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

// 多角形面積 (絶対値, mm^2)
export function polygonArea(points: Point[]): number {
  return Math.abs(signedArea(points));
}

// mm^2 → 平米 (m^2)
export function mm2ToM2(mm2: number): number {
  return mm2 / 1_000_000;
}

// mm^2 → 坪 (1坪 ≒ 3.305785 m^2)
export function mm2ToTsubo(mm2: number): number {
  return mm2ToM2(mm2) / 3.305785;
}

// 多角形の中心座標（重心ではなく外接矩形中心）
export function bboxCenter(points: Point[]): Point {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

// 全点を包含するバウンディングボックス
export function bbox(points: Point[]) {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

// 度 → ラジアン
export const deg2rad = (d: number) => (d * Math.PI) / 180;
// ラジアン → 度
export const rad2deg = (r: number) => (r * 180) / Math.PI;
