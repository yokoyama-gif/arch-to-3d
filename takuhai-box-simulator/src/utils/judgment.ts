import { PlacedObject, JudgmentResult, JudgmentSettings, RoomDefinition, JudgmentLevel } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getObjectRect(obj: PlacedObject): Rect {
  const isRotated = obj.rotation === 90 || obj.rotation === 270;
  return {
    x: obj.x,
    y: obj.y,
    width: isRotated ? obj.depth : obj.width,
    height: isRotated ? obj.width : obj.depth,
  };
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function getDoorSwingRect(door: PlacedObject): Rect | null {
  if (door.doorType === 'sliding' || door.doorType === 'auto') return null;
  const dw = door.doorWidth || 800;
  const r = getObjectRect(door);

  if (door.rotation === 0 || door.rotation === 180) {
    const swingDir = door.rotation === 0 ? -1 : 1;
    if (door.doorSwing === 'left') {
      return { x: r.x, y: r.y + swingDir * dw, width: dw, height: Math.abs(dw) };
    } else if (door.doorSwing === 'right') {
      return { x: r.x + r.width - dw, y: r.y + swingDir * dw, width: dw, height: Math.abs(dw) };
    } else {
      return { x: r.x, y: r.y + swingDir * dw, width: r.width, height: Math.abs(dw) };
    }
  } else {
    const swingDir = door.rotation === 90 ? 1 : -1;
    if (door.doorSwing === 'left') {
      return { x: r.x + swingDir * dw, y: r.y, width: Math.abs(dw), height: dw };
    } else if (door.doorSwing === 'right') {
      return { x: r.x + swingDir * dw, y: r.y + r.height - dw, width: Math.abs(dw), height: dw };
    } else {
      return { x: r.x + swingDir * dw, y: r.y, width: Math.abs(dw), height: r.height };
    }
  }
}

// Normalize a rect so width/height are positive
function normalizeRect(r: Rect): Rect {
  let { x, y, width, height } = r;
  if (width < 0) { x += width; width = -width; }
  if (height < 0) { y += height; height = -height; }
  return { x, y, width, height };
}

function getFrontOperationRect(obj: PlacedObject): Rect | null {
  if (obj.type !== 'delivery_box') return null;
  const fs = obj.frontSpace || 600;
  const r = getObjectRect(obj);

  switch (obj.rotation) {
    case 0:   return { x: r.x, y: r.y + r.height, width: r.width, height: fs };
    case 90:  return { x: r.x - fs, y: r.y, width: fs, height: r.height };
    case 180: return { x: r.x, y: r.y - fs, width: r.width, height: fs };
    case 270: return { x: r.x + r.width, y: r.y, width: fs, height: r.height };
    default:  return { x: r.x, y: r.y + r.height, width: r.width, height: fs };
  }
}

export function runJudgments(
  room: RoomDefinition,
  objects: PlacedObject[],
  settings: JudgmentSettings
): JudgmentResult[] {
  const results: JudgmentResult[] = [];

  const addResult = (objectId: string, level: JudgmentLevel, message: string, area?: Rect) => {
    results.push({ id: uuidv4(), objectId, level, message, area });
  };

  const roomRect: Rect = { x: 0, y: 0, width: room.width, height: room.depth };

  for (const obj of objects) {
    const r = getObjectRect(obj);

    // 1. 壁(部屋外)との干渉チェック
    if (r.x < 0 || r.y < 0 || r.x + r.width > room.width || r.y + r.height > room.depth) {
      addResult(obj.id, 'ng', `${obj.name}が部屋の外にはみ出しています`, r);
    }

    // 2. 他オブジェクトとの干渉
    for (const other of objects) {
      if (other.id === obj.id) continue;
      const or = getObjectRect(other);
      if (rectsOverlap(r, or)) {
        // 重複を避けるため id比較で一方のみ追加
        if (obj.id < other.id) {
          addResult(obj.id, 'ng', `${obj.name}と${other.name}が重なっています`, r);
        }
      }
    }

    // 3. 扉の開閉軌跡干渉
    if (obj.type === 'door') {
      const swingRect = getDoorSwingRect(obj);
      if (swingRect) {
        const norm = normalizeRect(swingRect);
        for (const other of objects) {
          if (other.id === obj.id || other.type === 'door') continue;
          const or = getObjectRect(other);
          if (rectsOverlap(norm, or)) {
            addResult(other.id, 'warning', `${other.name}が${obj.name}の開閉範囲に干渉しています`, norm);
          }
        }
      }
    }

    // 4. 宅配ボックス前面操作スペースチェック
    if (obj.type === 'delivery_box') {
      const frontRect = getFrontOperationRect(obj);
      if (frontRect) {
        // 操作スペースが部屋外にはみ出す
        if (
          frontRect.x < 0 ||
          frontRect.y < 0 ||
          frontRect.x + frontRect.width > room.width ||
          frontRect.y + frontRect.height > room.depth
        ) {
          addResult(obj.id, 'warning', `${obj.name}の前面操作スペースが不足しています`, frontRect);
        }
        // 操作スペースが他オブジェクトと干渉
        for (const other of objects) {
          if (other.id === obj.id) continue;
          const or = getObjectRect(other);
          if (rectsOverlap(frontRect, or)) {
            addResult(obj.id, 'warning', `${obj.name}の操作スペースに${other.name}があります`, frontRect);
          }
        }
      }
    }
  }

  // 5. 通路幅判定 (簡易: X方向のスキャンライン)
  const deliveryBoxes = objects.filter((o) => o.type === 'delivery_box');
  const doors = objects.filter((o) => o.type === 'door');

  // 扉前の滞留スペース
  for (const door of doors) {
    const dr = getObjectRect(door);
    const clearanceRect: Rect = {
      x: dr.x - settings.entranceClearance / 2,
      y: door.rotation === 0 ? dr.y - settings.entranceClearance : dr.y + dr.height,
      width: dr.width + settings.entranceClearance,
      height: settings.entranceClearance,
    };
    const norm = normalizeRect(clearanceRect);

    for (const obj of objects) {
      if (obj.id === door.id) continue;
      const or = getObjectRect(obj);
      if (rectsOverlap(norm, or)) {
        addResult(obj.id, 'warning', `${obj.name}が${door.name}の出入口前スペースに近すぎます`);
      }
    }
  }

  // 簡易通路幅: delivery_box同士の間、delivery_boxと壁の間
  for (let i = 0; i < deliveryBoxes.length; i++) {
    const r1 = getObjectRect(deliveryBoxes[i]);

    // 壁との距離（左壁、右壁、上壁、下壁）
    const distLeft = r1.x;
    const distRight = room.width - (r1.x + r1.width);
    const distTop = r1.y;
    const distBottom = room.depth - (r1.y + r1.height);

    // 前面方向以外の壁距離は通路幅に該当しないことが多いが、簡易的にチェック
    const wallDists = [
      { dist: distLeft, label: '左壁' },
      { dist: distRight, label: '右壁' },
      { dist: distTop, label: '上壁' },
      { dist: distBottom, label: '下壁' },
    ];
    for (const { dist, label } of wallDists) {
      if (dist > 0 && dist < settings.minCorridorWidth) {
        addResult(
          deliveryBoxes[i].id,
          'ng',
          `${deliveryBoxes[i].name}と${label}の間隔が${Math.round(dist)}mmで最低通路幅(${settings.minCorridorWidth}mm)を下回っています`
        );
      } else if (dist > 0 && dist < settings.recommendedCorridorWidth && dist >= settings.minCorridorWidth) {
        addResult(
          deliveryBoxes[i].id,
          'warning',
          `${deliveryBoxes[i].name}と${label}の間隔が${Math.round(dist)}mmで推奨通路幅(${settings.recommendedCorridorWidth}mm)を下回っています`
        );
      }
    }

    // 他のdelivery_boxとの間隔
    for (let j = i + 1; j < deliveryBoxes.length; j++) {
      const r2 = getObjectRect(deliveryBoxes[j]);
      // X方向の間隔
      const gapX = Math.max(0, Math.max(r2.x - (r1.x + r1.width), r1.x - (r2.x + r2.width)));
      // Y方向の間隔
      const gapY = Math.max(0, Math.max(r2.y - (r1.y + r1.height), r1.y - (r2.y + r2.height)));

      // 隣接配置の場合
      if (gapX === 0 && gapY === 0) continue; // overlapping - handled above

      const gap = Math.max(gapX, gapY);
      if (gap > 0 && gap < settings.minCorridorWidth) {
        addResult(
          deliveryBoxes[i].id,
          'ng',
          `${deliveryBoxes[i].name}と${deliveryBoxes[j].name}の通路幅が${Math.round(gap)}mmで不足しています`
        );
      }
    }
  }

  return results;
}

export function getOperationSpaceRects(objects: PlacedObject[]): Array<{ objectId: string; rect: Rect }> {
  return objects
    .filter((o) => o.type === 'delivery_box')
    .map((o) => ({ objectId: o.id, rect: getFrontOperationRect(o) }))
    .filter((r): r is { objectId: string; rect: Rect } => r.rect !== null);
}

export function getDoorSwingRects(objects: PlacedObject[]): Array<{ objectId: string; rect: Rect }> {
  return objects
    .filter((o) => o.type === 'door')
    .map((o) => ({ objectId: o.id, rect: getDoorSwingRect(o) }))
    .filter((r): r is { objectId: string; rect: Rect } => r.rect !== null)
    .map((r) => ({ ...r, rect: normalizeRect(r.rect) }));
}
