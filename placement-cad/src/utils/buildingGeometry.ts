import type { BuildingShape, Point } from '../types/drawing';

// 建物の幾何ユーティリティ。
// rotation の方向は CadCanvas の描画 (`SVG transform=rotate(-rotation, cx, cy)`) と一致させる。
// SVG (Y下) で `rotate(-rotation)` = 視覚上 CCW = CAD 座標系 (Y上) でも CCW (視覚回転は viewer 基準で同じ)。
// したがって本コードでは「rotation = +R 度 → CAD 座標で +R 度 CCW 回転」として扱う。
//
// rotation === 0 / 未指定 の場合は回転計算をスキップして既存挙動を完全維持する。

export function buildingCenter(b: BuildingShape): Point {
  return {
    x: b.origin.x + b.width / 2,
    y: b.origin.y + b.depth / 2,
  };
}

// 建物の 4 隅 (CAD 座標 mm)。回転後の実際の角を返す。
// 順序: 未回転フレームで 左下 → 右下 → 右上 → 左上。
export function buildingCorners(b: BuildingShape): [Point, Point, Point, Point] {
  const { origin: o, width: w, depth: d } = b;
  const base: [Point, Point, Point, Point] = [
    { x: o.x,     y: o.y },
    { x: o.x + w, y: o.y },
    { x: o.x + w, y: o.y + d },
    { x: o.x,     y: o.y + d },
  ];
  const rot = b.rotation ?? 0;
  if (rot === 0) return base;
  const c = buildingCenter(b);
  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  // 順方向: CCW 回転 [cos -sin; sin cos]
  return [
    rotateAround(base[0], c, cos, sin),
    rotateAround(base[1], c, cos, sin),
    rotateAround(base[2], c, cos, sin),
    rotateAround(base[3], c, cos, sin),
  ];
}

// 世界点 → 建物ローカル(未回転)フレームへ戻す。ヒットテスト用。
// 順方向が CCW 回転なら逆方向は CW 回転（行列の転置）。
export function buildingWorldToLocal(b: BuildingShape, p: Point): Point {
  const rot = b.rotation ?? 0;
  if (rot === 0) return p;
  const c = buildingCenter(b);
  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  // CW 回転 [cos sin; -sin cos]
  return {
    x: c.x + dx * cos + dy * sin,
    y: c.y - dx * sin + dy * cos,
  };
}

function rotateAround(p: Point, c: Point, cos: number, sin: number): Point {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return {
    x: c.x + dx * cos - dy * sin,
    y: c.y + dx * sin + dy * cos,
  };
}
