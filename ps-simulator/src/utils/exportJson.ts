import type { PlanData } from "../domain/types";

export function exportPlanToJson(plan: PlanData): void {
  const json = JSON.stringify(plan, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${plan.name || "plan"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
