import { libraryItems } from './presets';
import type {
  LayoutObject,
  LayoutPlan,
  LayoutTemplate,
  LibraryItem,
  ProjectSettings,
  RoomDoor,
  Rotation,
  Zone,
  ZoneType,
} from './types';
import { evaluatePlan } from '../logic/evaluation/evaluatePlan';

export const createId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export const createLibraryObject = (
  item: LibraryItem,
  x: number,
  y: number,
  rotation: Rotation = 0,
): LayoutObject => ({
  id: createId('object'),
  libraryItemId: item.id,
  type: item.type,
  name: item.name,
  category: item.category,
  x,
  y,
  width: item.width,
  height: item.height,
  rotation,
  seatCount: item.seatCount,
  fill: item.fill,
  stroke: item.stroke,
  metadata: structuredClone(item.metadata),
});

export const createDoor = (wall: RoomDoor['wall'] = 'bottom'): RoomDoor => ({
  id: createId('door'),
  name: '出入口',
  wall,
  offset: 1000,
  width: 1200,
  swing: 'inward',
});

export const createZone = (type: ZoneType = 'work'): Zone => ({
  id: createId('zone'),
  name:
    type === 'work'
      ? '執務ゾーン'
      : type === 'meeting'
        ? '会議ゾーン'
        : type === 'reception'
          ? '受付ゾーン'
          : type === 'support'
            ? '共用ゾーン'
            : type === 'lounge'
              ? 'ラウンジゾーン'
              : type === 'circulation'
                ? '通路ゾーン'
                : type === 'focus'
                  ? '集中ゾーン'
                  : 'カスタムゾーン',
  type,
  color:
    type === 'work'
      ? '#bfdbfe'
      : type === 'meeting'
        ? '#ddd6fe'
        : type === 'reception'
          ? '#bbf7d0'
          : type === 'support'
            ? '#fde68a'
            : type === 'lounge'
              ? '#fbcfe8'
              : type === 'circulation'
                ? '#cbd5e1'
                : type === 'focus'
                  ? '#bae6fd'
                  : '#fecdd3',
  rect: {
    x: 800,
    y: 800,
    width: 2600,
    height: 1800,
  },
});

export const createPlanFromTemplate = (
  template: LayoutTemplate,
  settings: ProjectSettings,
): LayoutPlan => {
  const objects = template.objects
    .map((templateObject) => {
      const libraryItem = libraryItems.find(
        (item) => item.id === templateObject.libraryItemId,
      );
      if (!libraryItem) {
        return null;
      }
      const object = createLibraryObject(
        libraryItem,
        templateObject.x,
        templateObject.y,
        templateObject.rotation ?? 0,
      );
      return {
        ...object,
        name: templateObject.name ?? object.name,
        width: templateObject.width ?? object.width,
        height: templateObject.height ?? object.height,
      };
    })
    .filter((object): object is LayoutObject => object !== null);

  const plan: LayoutPlan = {
    id: createId('plan'),
    name: template.name,
    room: {
      id: createId('room'),
      name: template.room.name,
      width: template.room.width,
      height: template.room.height,
      wallThickness: template.room.wallThickness,
      doors: template.room.doors.map((door) => ({
        ...door,
        id: createId('door'),
      })),
    },
    zones: template.zones.map((zone) => ({
      ...zone,
      id: createId('zone'),
    })),
    objects,
    evaluation: {
      issues: [],
      metrics: {
        totalSeats: 0,
        meetingSeats: 0,
        occupiedAreaRatio: 0,
        minCorridorWidth: 0,
        warningCount: 0,
        ngCount: 0,
        score: 100,
        zoneCount: 0,
        sharedAreaRatio: 0,
        pressureIndex: 0,
      },
    },
  };

  return {
    ...plan,
    evaluation: evaluatePlan(plan, settings),
  };
};
