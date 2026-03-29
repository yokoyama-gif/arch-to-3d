/** グリッドにスナップ */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
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
