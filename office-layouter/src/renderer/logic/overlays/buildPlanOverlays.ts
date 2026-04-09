import type {
  Issue,
  LayoutObject,
  LayoutPlan,
  LocalSide,
  OverlayKind,
  PlanOverlay,
  ProjectSettings,
  Severity,
} from '../../models/types';
import {
  getClearanceRectForSide,
  getDoorClearanceRect,
  getObjectRect,
  rotateLocalSide,
} from '../geometry/rect';

const severityRank: Record<Severity, number> = {
  ok: 0,
  warning: 1,
  ng: 2,
};

const issueCodeByOverlay: Record<OverlayKind, Issue['code']> = {
  corridor: 'CORRIDOR',
  chair: 'CHAIR_CLEARANCE',
  door: 'DOOR_BLOCKED',
  reception: 'RECEPTION_WAITING',
  copy: 'COPY_OPERATION',
  meeting: 'MEETING_ENTRY',
};

const maxSeverity = (current: Severity, next: Severity) =>
  severityRank[next] > severityRank[current] ? next : current;

const getOverlaySeverity = (
  issues: Issue[],
  kind: OverlayKind,
  objectId: string,
): Severity => {
  const issueCode = issueCodeByOverlay[kind];
  return issues.reduce<Severity>((severity, issue) => {
    if (issue.code !== issueCode || !issue.objectIds.includes(objectId)) {
      return severity;
    }
    return maxSeverity(severity, issue.severity);
  }, 'ok');
};

const createSideOverlays = (
  object: LayoutObject,
  kind: OverlayKind,
  depth: number,
  localSides: LocalSide[] | undefined,
  label: string,
  issues: Issue[],
  crossAxisPadding = 80,
) => {
  if (!localSides?.length) {
    return [] as PlanOverlay[];
  }

  const objectRect = getObjectRect(object);

  return localSides.map((localSide, index) => ({
    id: `${kind}-${object.id}-${localSide}-${index}`,
    kind,
    label,
    rect: getClearanceRectForSide(
      objectRect,
      rotateLocalSide(localSide, object.rotation),
      depth,
      crossAxisPadding,
    ),
    severity: getOverlaySeverity(issues, kind, object.id),
    objectIds: [object.id],
  }));
};

export const buildPlanOverlays = (
  plan: LayoutPlan,
  settings: Pick<
    ProjectSettings,
    | 'minCorridorWidth'
    | 'chairClearance'
    | 'doorClearance'
    | 'meetingEntryClearance'
  >,
): PlanOverlay[] => {
  const overlays: PlanOverlay[] = [];

  for (const object of plan.objects) {
    overlays.push(
      ...createSideOverlays(
        object,
        'corridor',
        settings.minCorridorWidth,
        object.metadata.localCorridorSides,
        `通路 ${settings.minCorridorWidth}mm`,
        plan.evaluation.issues,
      ),
    );

    overlays.push(
      ...createSideOverlays(
        object,
        'chair',
        settings.chairClearance,
        object.metadata.localChairSides,
        `椅子引き ${settings.chairClearance}mm`,
        plan.evaluation.issues,
        40,
      ),
    );

    if (
      object.metadata.frontOperationSide &&
      typeof object.metadata.frontOperationDepth === 'number'
    ) {
      overlays.push(
        ...createSideOverlays(
          object,
          'copy',
          object.metadata.frontOperationDepth,
          [object.metadata.frontOperationSide],
          `操作余白 ${object.metadata.frontOperationDepth}mm`,
          plan.evaluation.issues,
          100,
        ),
      );
    }

    if (
      object.metadata.waitingAreaSide &&
      typeof object.metadata.waitingAreaDepth === 'number'
    ) {
      overlays.push(
        ...createSideOverlays(
          object,
          'reception',
          object.metadata.waitingAreaDepth,
          [object.metadata.waitingAreaSide],
          `受付前 ${object.metadata.waitingAreaDepth}mm`,
          plan.evaluation.issues,
          140,
        ),
      );
    }

    if (object.category === 'meeting') {
      overlays.push(
        ...createSideOverlays(
          object,
          'meeting',
          settings.meetingEntryClearance,
          object.metadata.meetingEntrySides ?? object.metadata.localCorridorSides,
          `会議入口 ${settings.meetingEntryClearance}mm`,
          plan.evaluation.issues,
          120,
        ),
      );
    }
  }

  for (const door of plan.room.doors) {
    overlays.push({
      id: `door-${door.id}`,
      kind: 'door',
      label: `扉前 ${settings.doorClearance}mm`,
      rect: getDoorClearanceRect(door, plan.room, settings.doorClearance),
      severity: getOverlaySeverity(plan.evaluation.issues, 'door', `door:${door.id}`),
      objectIds: [`door:${door.id}`],
    });
  }

  return overlays;
};
