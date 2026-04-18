import type { LayoutObject, ProjectSettings, Rect, Room } from '../../models/types';
import {
  getNearestWallDistance,
  getObjectRect,
  getRotatedSize,
  snapValue,
} from '../geometry/rect';

export const clampObjectToRoom = (
  object: LayoutObject,
  room: Room,
  x: number,
  y: number,
) => {
  const size = getRotatedSize(object.width, object.height, object.rotation);
  const maxX = room.width - size.width;
  const maxY = room.height - size.height;

  return {
    x: Math.min(Math.max(0, x), Math.max(0, maxX)),
    y: Math.min(Math.max(0, y), Math.max(0, maxY)),
  };
};

export const getPlacementRect = (
  object: LayoutObject,
  x: number,
  y: number,
): Rect => {
  const size = getRotatedSize(object.width, object.height, object.rotation);
  return { x, y, width: size.width, height: size.height };
};

export const applyWallSnap = (
  object: LayoutObject,
  room: Room,
  settings: ProjectSettings,
  x: number,
  y: number,
) => {
  const rect = getPlacementRect(object, x, y);
  const distances = getNearestWallDistance(rect, room);
  const nextPosition = { x, y };

  if (distances.left <= settings.wallSnapThreshold) {
    nextPosition.x = 0;
  }
  if (distances.right <= settings.wallSnapThreshold) {
    nextPosition.x = room.width - rect.width;
  }
  if (distances.top <= settings.wallSnapThreshold) {
    nextPosition.y = 0;
  }
  if (distances.bottom <= settings.wallSnapThreshold) {
    nextPosition.y = room.height - rect.height;
  }

  return nextPosition;
};

export const applySnapping = (
  object: LayoutObject,
  room: Room,
  settings: ProjectSettings,
  x: number,
  y: number,
) => {
  const gridX = settings.snapToGrid ? snapValue(x, settings.gridSize) : x;
  const gridY = settings.snapToGrid ? snapValue(y, settings.gridSize) : y;
  const wallSnapped = applyWallSnap(object, room, settings, gridX, gridY);
  return clampObjectToRoom(object, room, wallSnapped.x, wallSnapped.y);
};

export const snapExistingObjectToRoom = (
  object: LayoutObject,
  room: Room,
  settings: ProjectSettings,
) => {
  const rect = getObjectRect(object);
  const snapped = applySnapping(object, room, settings, rect.x, rect.y);
  return { ...object, x: snapped.x, y: snapped.y };
};
