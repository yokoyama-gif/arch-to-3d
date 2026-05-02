/** グリッドにスナップ（原点0スタート） */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * グリッドオフセット込みのスナップ。
 * グリッド線が `offset + n*gridSize` の位置にある場合、最寄りに丸める。
 */
export function snapToGridWithOffset(
  value: number,
  gridSize: number,
  offset: number
): number {
  return offset + Math.round((value - offset) / gridSize) * gridSize;
}

/**
 * 9点アンカー定義（矩形のどの点を基準点として配置するか）
 *  - 1文字目: t(top) / m(middle) / b(bottom)
 *  - 2文字目: l(left) / c(center) / r(right)
 */
export type Anchor =
  | "tl" | "tc" | "tr"
  | "ml" | "mc" | "mr"
  | "bl" | "bc" | "br";

/** 全アンカーを配列で取得（UI表示順: 上→中→下、左→中→右） */
export const ALL_ANCHORS: Anchor[] = [
  "tl", "tc", "tr",
  "ml", "mc", "mr",
  "bl", "bc", "br",
];

/**
 * 指定アンカー点を click(x,y) に合わせるよう、左上座標を補正する。
 * 例えば anchor="mc"（中心）を選んでクリックした場合、
 * クリック点が矩形の中心になるよう x,y を w/2,h/2 だけずらす。
 */
export function applyAnchorOffset(
  clickX: number,
  clickY: number,
  w: number,
  h: number,
  anchor: Anchor
): { x: number; y: number } {
  const v = anchor.charAt(0); // t/m/b
  const hAxis = anchor.charAt(1); // l/c/r

  let x = clickX;
  let y = clickY;
  if (hAxis === "c") x -= w / 2;
  else if (hAxis === "r") x -= w;
  if (v === "m") y -= h / 2;
  else if (v === "b") y -= h;

  return { x, y };
}

/** 2つの矩形が重なっているか判定 */
export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** 重なりペアを検出 */
export function findOverlappingPairs(
  items: { id: string; x: number; y: number; w: number; h: number }[]
): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (rectsOverlap(items[i], items[j])) {
        pairs.push([items[i].id, items[j].id]);
      }
    }
  }
  return pairs;
}
