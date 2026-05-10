import type { DimensionShape, Drawing, Point, Shape } from '../types/drawing';
import { signedArea } from './geometry';

// 自動寸法線生成（敷地・建物の各辺に外側オフセット）
// 戻り値は DimensionShape の配列（id は計算ベース）。
// CAD の表示専用レイヤと、実体化（drawing.shapes に追加）の両方で使える。

const SITE_OFFSET_MM     = 1500; // 敷地辺の寸法位置オフセット
const BUILDING_OFFSET_MM = 1500; // 建物辺の寸法位置オフセット

// ポリゴン重心（単純な質量中心）
function centroid(pts: Point[]): Point {
  let cx = 0, cy = 0, n = pts.length;
  for (const p of pts) { cx += p.x; cy += p.y; }
  return { x: cx / n, y: cy / n };
}

// 敷地（ポリゴン）の各辺に外向きの寸法線を生成
function autoDimsForSite(siteId: string, pts: Point[]): DimensionShape[] {
  if (pts.length < 3) return [];
  const c = centroid(pts);
  const ccw = signedArea(pts) > 0; // CCW = 正
  const out: DimensionShape[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    // computeDimensionGeometry のオフセットは (−dy, dx)/len 方向。
    // 重心と辺中点を比べて「外側」に飛ばすよう符号決定。
    const midx = (a.x + b.x) / 2;
    const midy = (a.y + b.y) / 2;
    const nx = -dy / len, ny = dx / len;
    const dot = (c.x - midx) * nx + (c.y - midy) * ny;
    // dot > 0 → 重心は法線方向（左）に。外側は逆 → offset 負
    const sign = dot > 0 ? -1 : 1;
    out.push({
      id: `auto-dim-${siteId}-${i}`,
      type: 'dimension',
      start: a,
      end: b,
      offset: sign * SITE_OFFSET_MM,
    });
    // ccw 変数を ESLint 黙らせ用に参照（将来 CCW 補正で使う想定）
    void ccw;
  }
  return out;
}

// 建物の幅と奥行きの寸法（南辺と西辺の外側に表示）
function autoDimsForBuilding(b: { id: string; origin: Point; width: number; depth: number }): DimensionShape[] {
  const o = b.origin;
  return [
    {
      // 幅（南辺の下、Y がマイナス側）
      id: `auto-dim-${b.id}-w`,
      type: 'dimension',
      start: { x: o.x,            y: o.y },
      end:   { x: o.x + b.width,  y: o.y },
      offset: -BUILDING_OFFSET_MM,
    },
    {
      // 奥行き（西辺の左、X がマイナス側）
      id: `auto-dim-${b.id}-d`,
      type: 'dimension',
      // 西辺の方向を「下→上」(+Y) にすると法線は (-1,0)。offset 正でさらに左 (X-) へ。
      start: { x: o.x, y: o.y },
      end:   { x: o.x, y: o.y + b.depth },
      offset: BUILDING_OFFSET_MM,
    },
  ];
}

// すべての敷地・建物について自動寸法を生成
export function generateAutoDimensions(drawing: Drawing): DimensionShape[] {
  const out: DimensionShape[] = [];
  for (const s of drawing.shapes) {
    if (s.type === 'site')      out.push(...autoDimsForSite(s.id, s.points));
    else if (s.type === 'building') out.push(...autoDimsForBuilding(s));
  }
  return out;
}

// 実体として drawing.shapes に追加（永続化したい時用）。
// 自動寸法 ID は決定論的（auto-dim-{shapeId}-...）なので、
// 同じ ID が既に存在する場合は再追加せず、複数回呼び出しても増えないようにする。
export function materializeAutoDimensions(drawing: Drawing): Shape[] {
  const existing = new Set(drawing.shapes.map(s => s.id));
  const additions = generateAutoDimensions(drawing).filter(d => !existing.has(d.id));
  if (additions.length === 0) return drawing.shapes;
  return [...drawing.shapes, ...additions];
}
