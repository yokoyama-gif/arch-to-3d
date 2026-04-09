import { describe, expect, it } from 'vitest';
import { evaluatePlan } from './evaluatePlan';
import type { LayoutPlan, ProjectSettings } from '../../models/types';

const settings: ProjectSettings = {
  unit: 'mm',
  gridSize: 100,
  snapToGrid: true,
  minCorridorWidth: 900,
  chairClearance: 800,
  wallSnapThreshold: 120,
  doorClearance: 1200,
  meetingEntryClearance: 1100,
  receptionServiceDistance: 4500,
  commonAreaClearance: 1000,
  autoLayoutGap: 400,
};

const basePlan: LayoutPlan = {
  id: 'plan-1',
  name: '案 1',
  room: {
    id: 'room-1',
    name: 'Room',
    width: 5000,
    height: 4000,
    wallThickness: 180,
    doors: [
      {
        id: 'door-1',
        name: '入口',
        wall: 'bottom',
        offset: 1000,
        width: 1200,
        swing: 'inward',
      },
    ],
  },
  zones: [],
  objects: [],
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

describe('evaluatePlan', () => {
  it('counts seating and detects overlap', () => {
    const result = evaluatePlan(
      {
        ...basePlan,
        objects: [
          {
            id: 'desk-1',
            libraryItemId: 'desk-single',
            type: 'desk-single',
            name: 'Desk',
            category: 'desk',
            x: 400,
            y: 500,
            width: 1400,
            height: 700,
            rotation: 0,
            seatCount: 1,
            fill: '#fff',
            stroke: '#000',
            metadata: {
              localCorridorSides: ['bottom'],
              localChairSides: ['bottom'],
              preferredZoneTypes: ['work'],
            },
          },
          {
            id: 'meeting-1',
            libraryItemId: 'meeting-4',
            type: 'meeting-4',
            name: 'Meeting',
            category: 'meeting',
            x: 1000,
            y: 800,
            width: 1800,
            height: 900,
            rotation: 0,
            seatCount: 4,
            fill: '#fff',
            stroke: '#000',
            metadata: {
              localCorridorSides: ['top', 'bottom'],
              localChairSides: ['top', 'bottom'],
              meetingEntrySides: ['left', 'right'],
              preferredZoneTypes: ['meeting'],
            },
          },
        ],
      },
      settings,
    );

    expect(result.metrics.totalSeats).toBe(5);
    expect(result.metrics.meetingSeats).toBe(4);
    expect(result.issues.some((issue) => issue.code === 'OVERLAP')).toBe(true);
    expect(result.metrics.ngCount).toBeGreaterThan(0);
  });

  it('detects door blocking, pressure, and zone imbalance', () => {
    const result = evaluatePlan(
      {
        ...basePlan,
        room: {
          ...basePlan.room,
          width: 4200,
          height: 3500,
        },
        zones: [
          {
            id: 'zone-1',
            name: '会議ゾーン',
            type: 'meeting',
            color: '#ddd6fe',
            rect: { x: 3000, y: 500, width: 1200, height: 1000 },
          },
        ],
        objects: [
          {
            id: 'reception-1',
            libraryItemId: 'reception-counter',
            type: 'reception-counter',
            name: 'Reception',
            category: 'reception',
            x: 3200,
            y: 2800,
            width: 2400,
            height: 800,
            rotation: 0,
            seatCount: 0,
            fill: '#fff',
            stroke: '#000',
            metadata: {
              localCorridorSides: ['bottom'],
              waitingAreaSide: 'bottom',
              waitingAreaDepth: 1400,
              preferredZoneTypes: ['reception'],
            },
          },
          {
            id: 'locker-1',
            libraryItemId: 'locker',
            type: 'locker',
            name: 'Locker',
            category: 'storage',
            x: 900,
            y: 2750,
            width: 1800,
            height: 500,
            rotation: 0,
            seatCount: 0,
            fill: '#fff',
            stroke: '#000',
            metadata: {
              localCorridorSides: ['bottom'],
              preferredZoneTypes: ['support'],
            },
          },
          {
            id: 'meeting-2',
            libraryItemId: 'meeting-6',
            type: 'meeting-6',
            name: 'Meeting',
            category: 'meeting',
            x: 400,
            y: 500,
            width: 2400,
            height: 1100,
            rotation: 0,
            seatCount: 6,
            fill: '#fff',
            stroke: '#000',
            metadata: {
              localCorridorSides: ['top', 'right', 'bottom', 'left'],
              localChairSides: ['top', 'right', 'bottom', 'left'],
              meetingEntrySides: ['left', 'right'],
              preferredZoneTypes: ['meeting'],
            },
          },
          {
            id: 'desk-1',
            libraryItemId: 'desk-free-address',
            type: 'desk-free-address',
            name: 'Dense desk',
            category: 'desk',
            x: 200,
            y: 2000,
            width: 3200,
            height: 1600,
            rotation: 0,
            seatCount: 6,
            fill: '#fff',
            stroke: '#000',
            metadata: {
              localCorridorSides: ['left', 'right'],
              localChairSides: ['top', 'bottom'],
              preferredZoneTypes: ['work'],
            },
          },
        ],
      },
      settings,
    );

    expect(result.issues.some((issue) => issue.code === 'DOOR_BLOCKED')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'ZONE_BALANCE')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'PRESSURE')).toBe(true);
    expect(result.metrics.score).toBeLessThan(100);
  });
});
