import type { LayoutObject, Zone, ZoneType } from '../../models/types';
import { getIntersectionArea, getObjectRect, getRectArea } from '../geometry/rect';

export const getZoneAreaByType = (zones: Zone[]) =>
  zones.reduce<Record<ZoneType, number>>(
    (acc, zone) => {
      acc[zone.type] += getRectArea(zone.rect);
      return acc;
    },
    {
      work: 0,
      meeting: 0,
      reception: 0,
      support: 0,
      lounge: 0,
      circulation: 0,
      focus: 0,
      custom: 0,
    },
  );

export const getObjectZoneFit = (object: LayoutObject, zones: Zone[]) => {
  if (!object.metadata.preferredZoneTypes?.length || zones.length === 0) {
    return 1;
  }

  const objectRect = getObjectRect(object);
  const preferredZones = zones.filter((zone) =>
    object.metadata.preferredZoneTypes?.includes(zone.type),
  );
  const fitArea = preferredZones.reduce(
    (sum, zone) => sum + getIntersectionArea(objectRect, zone.rect),
    0,
  );
  return fitArea / Math.max(1, getRectArea(objectRect));
};
