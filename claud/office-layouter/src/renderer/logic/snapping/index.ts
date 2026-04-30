/** グリッドスナップ */
export function snapToGrid(value: number, grid: number): number {
  if (grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

/** 矩形を部屋内に収めるクランプ */
export function clampToRoom(
  x: number,
  y: number,
  w: number,
  h: number,
  roomW: number,
  roomH: number,
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(roomW - w, x)),
    y: Math.max(0, Math.min(roomH - h, y)),
  };
}
