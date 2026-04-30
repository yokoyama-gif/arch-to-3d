import type { LayoutPlan, LayoutObject } from "../../models/types";
import { libraryItemByKind } from "../../models/presets";

const MEETING_KINDS = new Set(["meeting-4", "meeting-6"]);

export function totalSeats(plan: LayoutPlan): number {
  return plan.objects.reduce((sum, o) => sum + (o.seats ?? 0), 0);
}

export function meetingSeats(plan: LayoutPlan): number {
  return plan.objects
    .filter((o) => MEETING_KINDS.has(o.kind))
    .reduce((sum, o) => sum + (o.seats ?? 0), 0);
}

/** 占有率: 配置オブジェクト合計面積 / 部屋面積 */
export function occupancyRatio(plan: LayoutPlan): number {
  const roomArea = plan.room.width * plan.room.height;
  if (roomArea <= 0) return 0;
  const used = plan.objects.reduce((sum, o) => sum + o.width * o.height, 0);
  return Math.min(1, used / roomArea);
}

export function isSeatingObject(o: LayoutObject): boolean {
  const item = libraryItemByKind(o.kind);
  return !!item?.seats && item.seats > 0;
}
