import { describe, expect, it } from 'vitest';
import { autoArrangeObjects } from './autoArrange';
import type { LayoutPlan } from '../../models/types';

const plan: LayoutPlan = {
  id: 'plan-1',
  name: '案 1',
  room: {
    id: 'room-1',
    name: 'Room',
    width: 10000,
    height: 7000,
    wallThickness: 180,
    doors: [],
  },
  zones: [
    {
      id: 'zone-work',
      name: '執務',
      type: 'work',
      color: '#bfdbfe',
      rect: { x: 800, y: 800, width: 5200, height: 5000 },
    },
    {
      id: 'zone-meeting',
      name: '会議',
      type: 'meeting',
      color: '#ddd6fe',
      rect: { x: 6400, y: 800, width: 2200, height: 2600 },
    },
  ],
  objects: [
    {
      id: 'desk-1',
      libraryItemId: 'desk-island-4',
      type: 'desk-island-4',
      name: 'Desk',
      category: 'desk',
      x: 0,
      y: 0,
      width: 2800,
      height: 1400,
      rotation: 0,
      seatCount: 4,
      fill: '#fff',
      stroke: '#000',
      metadata: { preferredZoneTypes: ['work'] },
    },
    {
      id: 'meeting-1',
      libraryItemId: 'meeting-4',
      type: 'meeting-4',
      name: 'Meeting',
      category: 'meeting',
      x: 0,
      y: 0,
      width: 1800,
      height: 900,
      rotation: 0,
      seatCount: 4,
      fill: '#fff',
      stroke: '#000',
      metadata: { preferredZoneTypes: ['meeting'] },
    },
  ],
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

describe('autoArrangeObjects', () => {
  it('places objects into their preferred zones', () => {
    const arranged = autoArrangeObjects(plan, 300);
    const desk = arranged.find((object) => object.id === 'desk-1')!;
    const meeting = arranged.find((object) => object.id === 'meeting-1')!;

    expect(desk.x).toBeGreaterThanOrEqual(plan.zones[0]!.rect.x);
    expect(desk.y).toBeGreaterThanOrEqual(plan.zones[0]!.rect.y);
    expect(meeting.x).toBeGreaterThanOrEqual(plan.zones[1]!.rect.x);
    expect(meeting.y).toBeGreaterThanOrEqual(plan.zones[1]!.rect.y);
  });
});
