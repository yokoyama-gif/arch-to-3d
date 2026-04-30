import type { LayoutObject, Rect, Room } from "../../models/types";

/** 回転後の AABB（軸並行外接矩形）を返す。回転は90度単位前提 */
export function objectAABB(obj: LayoutObject): Rect {
  const isSwapped = obj.rotation === 90 || obj.rotation === 270;
  const w = isSwapped ? obj.height : obj.width;
  const h = isSwapped ? obj.width : obj.height;
  return { x: obj.x, y: obj.y, width: w, height: h };
}

/** 矩形拡張 (各辺に padding を追加) */
export function expandRect(r: Rect, padding: number): Rect {
  return {
    x: r.x - padding,
    y: r.y - padding,
    width: r.width + padding * 2,
    height: r.height + padding * 2,
  };
}

/** 矩形同士の重なり判定 */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

/** 矩形の重なり面積 */
export function intersectionArea(a: Rect, b: Rect): number {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return x * y;
}

/** 部屋外はみ出し判定 */
export function isOutOfRoom(rect: Rect, room: Room): boolean {
  return (
    rect.x < 0 ||
    rect.y < 0 ||
    rect.x + rect.width > room.width ||
    rect.y + rect.height > room.height
  );
}

/** 二矩形の最近接距離（重なっていれば 0） */
export function minGap(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height)));
  return Math.hypot(dx, dy);
}

/** 軸方向の最小空き幅。dir="x" なら水平方向の通路幅、"y"なら垂直方向。
 *  矩形が片方の軸で重なっていない場合は Infinity を返す（その方向に通路が無い）。*/
export function aisleGap(a: Rect, b: Rect, dir: "x" | "y"): number {
  if (dir === "x") {
    const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    if (overlapY <= 0) return Infinity;
    return Math.max(0, Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width)));
  }
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  if (overlapX <= 0) return Infinity;
  return Math.max(0, Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height)));
}
