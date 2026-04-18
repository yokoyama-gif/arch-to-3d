import type { LayoutObject, LayoutPlan, Room, Zone, ZoneType } from '../../models/types';
import { getObjectRect, getRotatedSize } from '../geometry/rect';

const categoryOrder: Array<LayoutObject['category']> = [
  'reception',
  'support',
  'storage',
  'meeting',
  'desk',
  'lounge',
  'structure',
];

const zonePreferenceFallback: Record<LayoutObject['category'], ZoneType[]> = {
  reception: ['reception', 'lounge'],
  support: ['support', 'circulation'],
  storage: ['support', 'circulation'],
  meeting: ['meeting'],
  desk: ['work', 'focus'],
  lounge: ['lounge', 'reception'],
  structure: ['custom', 'support'],
};

const sortObjectsForLayout = (objects: LayoutObject[]) =>
  [...objects].sort(
    (left, right) =>
      categoryOrder.indexOf(left.category) - categoryOrder.indexOf(right.category),
  );

const findZoneForObject = (object: LayoutObject, zones: Zone[], room: Room) => {
  const preferred =
    object.metadata.preferredZoneTypes && object.metadata.preferredZoneTypes.length > 0
      ? object.metadata.preferredZoneTypes
      : zonePreferenceFallback[object.category];
  return (
    zones.find((zone) => preferred.includes(zone.type)) ?? {
      id: room.id,
      name: room.name,
      type: 'custom' as ZoneType,
      color: '#ffffff',
      rect: { x: 600, y: 600, width: room.width - 1200, height: room.height - 1200 },
    }
  );
};

export const autoArrangeObjects = (
  plan: LayoutPlan,
  gap: number,
): LayoutObject[] => {
  const zones = plan.zones;
  const cursorMap = new Map<string, { x: number; y: number; rowHeight: number }>();

  return sortObjectsForLayout(plan.objects).map((object) => {
    if (object.category === 'structure' && object.type === 'column') {
      return object;
    }

    const zone = findZoneForObject(object, zones, plan.room);
    const size = getRotatedSize(object.width, object.height, object.rotation);
    const zoneKey = zone.id;
    const cursor =
      cursorMap.get(zoneKey) ?? {
        x: zone.rect.x + gap,
        y: zone.rect.y + gap,
        rowHeight: 0,
      };

    let nextX = cursor.x;
    let nextY = cursor.y;

    if (object.metadata.keepNearWall) {
      nextX = zone.rect.x + gap;
      nextY = zone.rect.y + gap;
    }

    if (nextX + size.width > zone.rect.x + zone.rect.width - gap) {
      nextX = zone.rect.x + gap;
      nextY = cursor.y + cursor.rowHeight + gap;
      cursor.rowHeight = 0;
    }

    if (nextY + size.height > zone.rect.y + zone.rect.height - gap) {
      nextY = zone.rect.y + gap;
    }

    const rowHeight = Math.max(cursor.rowHeight, size.height);
    cursorMap.set(zoneKey, {
      x: nextX + size.width + gap,
      y: nextY,
      rowHeight,
    });

    return {
      ...object,
      x: nextX,
      y: nextY,
    };
  });
};
