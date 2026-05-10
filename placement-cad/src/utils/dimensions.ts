import type { Point } from '../types/drawing';
import { distance } from './geometry';

// 寸法テキストフォーマット
// 配置図では mm 表記が一般的だが、長距離は m 併記する場合もある。
// ここでは整数 mm 表記をデフォルトにし、必要ならオプションで m 表記に。
export function formatDimensionText(
  start: Point,
  end: Point,
  opts?: { unit?: 'mm' | 'm'; digits?: number },
): string {
  const d = distance(start, end);
  const unit = opts?.unit ?? 'mm';
  if (unit === 'm') {
    const digits = opts?.digits ?? 2;
    return `${(d / 1000).toFixed(digits)} m`;
  }
  return `${Math.round(d)}`;
}

// 寸法線の補助線・テキスト位置の計算
// 2点間 (start→end) に対し、垂直方向に offset(mm) ずらした位置に
// 寸法線を描画する想定。SVG 描画用に必要な座標を返す。
export function computeDimensionGeometry(
  start: Point,
  end: Point,
  offset: number,
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  // 法線（左手側を正とする）
  const nx = -dy / len;
  const ny = dx / len;

  const offStart: Point = { x: start.x + nx * offset, y: start.y + ny * offset };
  const offEnd:   Point = { x: end.x   + nx * offset, y: end.y   + ny * offset };
  const mid:      Point = { x: (offStart.x + offEnd.x) / 2, y: (offStart.y + offEnd.y) / 2 };

  // テキストの回転角（度）。CADでは寸法は線方向に沿って表示するのが一般的。
  let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  // 上下逆さま防止：-90〜90 の範囲に収める
  if (angleDeg > 90)  angleDeg -= 180;
  if (angleDeg < -90) angleDeg += 180;

  return {
    start, end,
    offStart, offEnd,
    mid,
    angleDeg,
    length: len,
  };
}
