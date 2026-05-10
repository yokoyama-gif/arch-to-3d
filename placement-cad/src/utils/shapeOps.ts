import type {
  Shape, Point,
  SiteShape, BuildingShape, RoadShape, DimensionShape, CompassShape,
} from '../types/drawing';

// 既定値（暫定値。将来 PropertyPanel から編集可能にする想定）
export const DEFAULT_ROAD_WIDTH_MM      = 4000;
export const DEFAULT_DIMENSION_OFFSET_MM = 1500;
export const DEFAULT_COMPASS_RADIUS_MM   = 1200;
export const DEFAULT_COMPASS_NORTH_DEG   = 90;

// ===== ID 生成 =====
let counter = 0;
export function genId(prefix: string): string {
  counter++;
  const t = Date.now().toString(36).slice(-4);
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${t}-${counter}`;
}

// ===== 図形の平行移動 =====
export function moveShape(s: Shape, dx: number, dy: number): Shape {
  switch (s.type) {
    case 'site':
      return { ...s, points: s.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
    case 'road':
      return { ...s, centerLine: s.centerLine.map(p => ({ x: p.x + dx, y: p.y + dy })) };
    case 'building':
      return { ...s, origin: { x: s.origin.x + dx, y: s.origin.y + dy } };
    case 'dimension':
      return {
        ...s,
        start: { x: s.start.x + dx, y: s.start.y + dy },
        end:   { x: s.end.x + dx,   y: s.end.y + dy },
      };
    case 'compass':
      return { ...s, center: { x: s.center.x + dx, y: s.center.y + dy } };
  }
}

// ===== ファクトリ =====
export function makeSite(points: Point[]): SiteShape {
  return { id: genId('site'), type: 'site', points };
}

export function makeBuilding(p1: Point, p2: Point, name = '計画建物'): BuildingShape {
  const origin = { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) };
  const width  = Math.abs(p2.x - p1.x);
  const depth  = Math.abs(p2.y - p1.y);
  return {
    id: genId('building'),
    type: 'building',
    origin,
    width,
    depth,
    rotation: 0,
    name,
  };
}

export function makeRoad(p1: Point, p2: Point, width = DEFAULT_ROAD_WIDTH_MM): RoadShape {
  return {
    id: genId('road'),
    type: 'road',
    centerLine: [p1, p2],
    width,
  };
}

export function makeDimension(p1: Point, p2: Point, offset = DEFAULT_DIMENSION_OFFSET_MM): DimensionShape {
  return {
    id: genId('dim'),
    type: 'dimension',
    start: p1,
    end: p2,
    offset,
  };
}

export function makeCompass(
  center: Point,
  radius = DEFAULT_COMPASS_RADIUS_MM,
  northAngle = DEFAULT_COMPASS_NORTH_DEG,
): CompassShape {
  return {
    id: genId('compass'),
    type: 'compass',
    center,
    radius,
    northAngle,
  };
}
