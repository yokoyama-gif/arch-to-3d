import type { Point } from '../types/drawing';

// グリッドスナップ (mm)
// 配置図では 100mm / 500mm / 1000mm を主に使う
export function snapToGrid(p: Point, grid: number): Point {
  return {
    x: Math.round(p.x / grid) * grid,
    y: Math.round(p.y / grid) * grid,
  };
}

// 端点スナップ用：最寄り点（既存図形の頂点リスト）に近ければ吸着
export function snapToNearest(
  p: Point,
  candidates: Point[],
  threshold: number,
): Point {
  let best: Point | null = null;
  let bestD = threshold;
  for (const c of candidates) {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best ?? p;
}

// 直交スナップ：基点 base からの方向を 0/90/180/270 にスナップ
export function snapOrtho(base: Point, p: Point): Point {
  const dx = p.x - base.x;
  const dy = p.y - base.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: p.x, y: base.y };
  }
  return { x: base.x, y: p.y };
}
