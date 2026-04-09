import type {
  LayoutObject,
  LocalSide,
  Rect,
  Rotation,
  Room,
  RoomDoor,
  WallSide,
} from '../../models/types';

const sideOrder: LocalSide[] = ['top', 'right', 'bottom', 'left'];

export const normalizeRotation = (rotation: number): Rotation => {
  const normalized = ((rotation % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized as Rotation;
  }
  return 0;
};

export const getRoomRect = (room: Room): Rect => ({
  x: 0,
  y: 0,
  width: room.width,
  height: room.height,
});

export const getRotatedSize = (
  width: number,
  height: number,
  rotation: Rotation,
) => {
  if (rotation === 90 || rotation === 270) {
    return { width: height, height: width };
  }

  return { width, height };
};

export const getObjectRect = (object: LayoutObject): Rect => {
  const size = getRotatedSize(object.width, object.height, object.rotation);
  return {
    x: object.x,
    y: object.y,
    width: size.width,
    height: size.height,
  };
};

export const getRectCenter = (rect: Rect) => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

export const getRectArea = (rect: Rect) => rect.width * rect.height;

export const rectanglesIntersect = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

export const getIntersectionRect = (a: Rect, b: Rect): Rect | null => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const width = Math.min(a.x + a.width, b.x + b.width) - x;
  const height = Math.min(a.y + a.height, b.y + b.height) - y;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { x, y, width, height };
};

export const getIntersectionArea = (a: Rect, b: Rect) =>
  getRectArea(getIntersectionRect(a, b) ?? { x: 0, y: 0, width: 0, height: 0 });

export const isRectInside = (rect: Rect, container: Rect) =>
  rect.x >= container.x &&
  rect.y >= container.y &&
  rect.x + rect.width <= container.x + container.width &&
  rect.y + rect.height <= container.y + container.height;

export const rotateLocalSide = (
  side: LocalSide,
  rotation: Rotation,
): LocalSide => {
  const index = sideOrder.indexOf(side);
  const steps = rotation / 90;
  return sideOrder[(index + steps) % sideOrder.length]!;
};

export const snapValue = (value: number, gridSize: number) =>
  Math.round(value / gridSize) * gridSize;

export const getSideGap = (
  rect: Rect,
  side: LocalSide,
  otherRects: Rect[],
  roomRect: Rect,
) => {
  let gap =
    side === 'left'
      ? rect.x - roomRect.x
      : side === 'right'
        ? roomRect.x + roomRect.width - (rect.x + rect.width)
        : side === 'top'
          ? rect.y - roomRect.y
          : roomRect.y + roomRect.height - (rect.y + rect.height);

  for (const other of otherRects) {
    const overlapsOnCrossAxis =
      side === 'left' || side === 'right'
        ? rect.y < other.y + other.height && rect.y + rect.height > other.y
        : rect.x < other.x + other.width && rect.x + rect.width > other.x;

    if (!overlapsOnCrossAxis) {
      continue;
    }

    const candidateGap =
      side === 'left'
        ? rect.x - (other.x + other.width)
        : side === 'right'
          ? other.x - (rect.x + rect.width)
          : side === 'top'
            ? rect.y - (other.y + other.height)
            : other.y - (rect.y + rect.height);

    if (candidateGap >= 0) {
      gap = Math.min(gap, candidateGap);
    }
  }

  return gap;
};

export const getNearestWallDistance = (rect: Rect, room: Room) => ({
  left: rect.x,
  right: room.width - (rect.x + rect.width),
  top: rect.y,
  bottom: room.height - (rect.y + rect.height),
});

export const getDoorRect = (door: RoomDoor, room: Room): Rect => {
  const thickness = room.wallThickness;
  if (door.wall === 'top' || door.wall === 'bottom') {
    return {
      x: door.offset,
      y: door.wall === 'top' ? 0 : room.height - thickness,
      width: door.width,
      height: thickness,
    };
  }

  return {
    x: door.wall === 'left' ? 0 : room.width - thickness,
    y: door.offset,
    width: thickness,
    height: door.width,
  };
};

export const getDoorClearanceRect = (
  door: RoomDoor,
  room: Room,
  depth: number,
): Rect => {
  const doorRect = getDoorRect(door, room);
  if (door.wall === 'top') {
    return { x: doorRect.x - 150, y: doorRect.y, width: doorRect.width + 300, height: depth };
  }
  if (door.wall === 'bottom') {
    return {
      x: doorRect.x - 150,
      y: room.height - depth,
      width: doorRect.width + 300,
      height: depth,
    };
  }
  if (door.wall === 'left') {
    return { x: doorRect.x, y: doorRect.y - 150, width: depth, height: doorRect.height + 300 };
  }
  return {
    x: room.width - depth,
    y: doorRect.y - 150,
    width: depth,
    height: doorRect.height + 300,
  };
};

export const getClearanceRectForSide = (
  rect: Rect,
  side: LocalSide,
  depth: number,
  crossAxisPadding = 0,
): Rect => {
  if (side === 'top') {
    return {
      x: rect.x - crossAxisPadding,
      y: rect.y - depth,
      width: rect.width + crossAxisPadding * 2,
      height: depth,
    };
  }

  if (side === 'right') {
    return {
      x: rect.x + rect.width,
      y: rect.y - crossAxisPadding,
      width: depth,
      height: rect.height + crossAxisPadding * 2,
    };
  }

  if (side === 'bottom') {
    return {
      x: rect.x - crossAxisPadding,
      y: rect.y + rect.height,
      width: rect.width + crossAxisPadding * 2,
      height: depth,
    };
  }

  return {
    x: rect.x - depth,
    y: rect.y - crossAxisPadding,
    width: depth,
    height: rect.height + crossAxisPadding * 2,
  };
};

export const getDistanceBetweenRects = (a: Rect, b: Rect) => {
  const centerA = getRectCenter(a);
  const centerB = getRectCenter(b);
  return Math.hypot(centerA.x - centerB.x, centerA.y - centerB.y);
};

export const alignRectToWall = (
  rect: Rect,
  room: Room,
  wall: WallSide,
): { x: number; y: number } => {
  if (wall === 'left') {
    return { x: 0, y: rect.y };
  }
  if (wall === 'right') {
    return { x: room.width - rect.width, y: rect.y };
  }
  if (wall === 'top') {
    return { x: rect.x, y: 0 };
  }
  return { x: rect.x, y: room.height - rect.height };
};
