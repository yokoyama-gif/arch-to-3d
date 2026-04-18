import type { LayoutPlan } from '../../models/types';

const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

export const exportPlanToCsv = (plan: LayoutPlan) => {
  const summaryRows = [
    ['Metric', 'Value'],
    ['Plan', plan.name],
    ['Total Seats', plan.evaluation.metrics.totalSeats],
    ['Meeting Seats', plan.evaluation.metrics.meetingSeats],
    ['Occupied Ratio', `${plan.evaluation.metrics.occupiedAreaRatio}%`],
    ['Min Corridor Width', `${plan.evaluation.metrics.minCorridorWidth}mm`],
    ['Warnings', plan.evaluation.metrics.warningCount],
    ['NG', plan.evaluation.metrics.ngCount],
    ['Score', plan.evaluation.metrics.score],
  ];

  const objectRows = [
    ['Objects'],
    ['Name', 'Category', 'X', 'Y', 'Width', 'Height', 'Rotation', 'Seats'],
    ...plan.objects.map((object) => [
      object.name,
      object.category,
      object.x,
      object.y,
      object.width,
      object.height,
      object.rotation,
      object.seatCount,
    ]),
  ];

  const zoneRows = [
    ['Zones'],
    ['Name', 'Type', 'X', 'Y', 'Width', 'Height'],
    ...plan.zones.map((zone) => [
      zone.name,
      zone.type,
      zone.rect.x,
      zone.rect.y,
      zone.rect.width,
      zone.rect.height,
    ]),
  ];

  const doorRows = [
    ['Doors'],
    ['Name', 'Wall', 'Offset', 'Width', 'Swing'],
    ...plan.room.doors.map((door) => [
      door.name,
      door.wall,
      door.offset,
      door.width,
      door.swing,
    ]),
  ];

  const issueRows = [
    ['Issues'],
    ['Severity', 'Code', 'Title', 'Description'],
    ...plan.evaluation.issues.map((issue) => [
      issue.severity,
      issue.code,
      issue.title,
      issue.description,
    ]),
  ];

  return [...summaryRows, [], ...objectRows, [], ...zoneRows, [], ...doorRows, [], ...issueRows]
    .map((row) => row.map((value) => escapeCsv(value)).join(','))
    .join('\n');
};
