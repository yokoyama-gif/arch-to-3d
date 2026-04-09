import { describe, expect, it } from 'vitest';
import { evaluatePlan } from '../evaluation/evaluatePlan';
import { buildPlanOverlays } from './buildPlanOverlays';
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

const plan: LayoutPlan = {
  id: 'plan-1',
  name: 'Overlay Plan',
  room: {
    id: 'room-1',
    name: 'Room',
    width: 7200,
    height: 4200,
    wallThickness: 180,
    doors: [
      {
        id: 'door-1',
        name: '入口',
        wall: 'bottom',
        offset: 900,
        width: 1200,
        swing: 'inward',
      },
    ],
  },
  zones: [],
  objects: [
    {
      id: 'desk-1',
      libraryItemId: 'desk-single',
      type: 'desk-single',
      name: 'Desk',
      category: 'desk',
      x: 900,
      y: 3000,
      width: 1400,
      height: 700,
      rotation: 0,
      seatCount: 1,
      fill: '#fff',
      stroke: '#000',
      metadata: {
        localCorridorSides: ['bottom'],
        localChairSides: ['bottom'],
      },
    },
    {
      id: 'copier-1',
      libraryItemId: 'copier',
      type: 'copier',
      name: 'Copier',
      category: 'support',
      x: 3000,
      y: 3000,
      width: 1000,
      height: 700,
      rotation: 0,
      seatCount: 0,
      fill: '#fff',
      stroke: '#000',
      metadata: {
        localCorridorSides: ['bottom'],
        frontOperationSide: 'bottom',
        frontOperationDepth: 900,
      },
    },
    {
      id: 'reception-1',
      libraryItemId: 'reception-counter',
      type: 'reception-counter',
      name: 'Reception',
      category: 'reception',
      x: 4600,
      y: 3000,
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
      },
    },
    {
      id: 'meeting-1',
      libraryItemId: 'meeting-4',
      type: 'meeting-4',
      name: 'Meeting',
      category: 'meeting',
      x: 120,
      y: 500,
      width: 1800,
      height: 900,
      rotation: 0,
      seatCount: 4,
      fill: '#fff',
      stroke: '#000',
      metadata: {
        localCorridorSides: ['top', 'right', 'bottom', 'left'],
        localChairSides: ['top', 'right', 'bottom', 'left'],
        meetingEntrySides: ['left', 'right'],
      },
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

describe('buildPlanOverlays', () => {
  it('creates overlays for main clearance rules and carries issue severity', () => {
    const evaluation = evaluatePlan(plan, settings);
    const overlays = buildPlanOverlays({ ...plan, evaluation }, settings);

    expect(overlays.some((overlay) => overlay.kind === 'corridor')).toBe(true);
    expect(overlays.some((overlay) => overlay.kind === 'chair')).toBe(true);
    expect(overlays.some((overlay) => overlay.kind === 'door')).toBe(true);
    expect(overlays.some((overlay) => overlay.kind === 'copy')).toBe(true);
    expect(overlays.some((overlay) => overlay.kind === 'reception')).toBe(true);
    expect(overlays.some((overlay) => overlay.kind === 'meeting')).toBe(true);

    expect(
      overlays.some(
        (overlay) =>
          overlay.kind === 'door' &&
          overlay.objectIds.includes('door:door-1') &&
          overlay.severity !== 'ok',
      ),
    ).toBe(true);

    expect(
      overlays.some(
        (overlay) =>
          overlay.kind === 'corridor' &&
          overlay.objectIds.includes('desk-1') &&
          overlay.severity !== 'ok',
      ),
    ).toBe(true);
  });
});
