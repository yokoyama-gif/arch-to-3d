import { describe, it, expect } from "vitest";
import { computeScore, evaluate } from "./index";
import type { LayoutPlan, ProjectSettings } from "../../models/types";

const settings: ProjectSettings = {
  gridSize: 100,
  minAisleWidth: 1200,
  showGrid: true,
  snapToGrid: false,
  unit: "mm",
};

function makePlan(): LayoutPlan {
  return {
    id: "p1",
    name: "p1",
    room: { width: 10000, height: 8000 },
    objects: [],
    zones: [],
  };
}

describe("evaluate", () => {
  it("clean plan: no issues, totalSeats reflects placed desks", () => {
    const plan = makePlan();
    plan.objects.push({
      id: "d1",
      kind: "desk1",
      label: "1人用デスク",
      x: 1000,
      y: 1000,
      width: 1200,
      height: 700,
      rotation: 0,
      seats: 1,
    });
    plan.objects.push({
      id: "d2",
      kind: "desk1",
      label: "1人用デスク",
      x: 5000,
      y: 5000,
      width: 1200,
      height: 700,
      rotation: 0,
      seats: 1,
    });
    const r = evaluate(plan, settings);
    expect(r.totalSeats).toBe(2);
    expect(r.ngCount).toBe(0);
  });

  it("flags out-of-room placement", () => {
    const plan = makePlan();
    plan.objects.push({
      id: "d1",
      kind: "desk1",
      label: "x",
      x: 9500,
      y: 0,
      width: 1200,
      height: 700,
      rotation: 0,
    });
    const r = evaluate(plan, settings);
    expect(r.issues.some((i) => i.rule === "out-of-room")).toBe(true);
    expect(r.ngCount).toBeGreaterThan(0);
  });

  it("flags overlap", () => {
    const plan = makePlan();
    plan.objects.push({
      id: "d1",
      kind: "desk1",
      label: "a",
      x: 1000,
      y: 1000,
      width: 1200,
      height: 700,
      rotation: 0,
    });
    plan.objects.push({
      id: "d2",
      kind: "desk1",
      label: "b",
      x: 1500,
      y: 1100,
      width: 1200,
      height: 700,
      rotation: 0,
    });
    const r = evaluate(plan, settings);
    expect(r.issues.some((i) => i.rule === "overlap")).toBe(true);
  });

  it("flags aisle width below minimum", () => {
    const plan = makePlan();
    plan.objects.push({
      id: "d1",
      kind: "desk1",
      label: "a",
      x: 1000,
      y: 1000,
      width: 1200,
      height: 700,
      rotation: 0,
    });
    plan.objects.push({
      id: "d2",
      kind: "desk1",
      label: "b",
      x: 2300,
      y: 1000,
      width: 1200,
      height: 700,
      rotation: 0,
    });
    const r = evaluate(plan, settings);
    expect(r.issues.some((i) => i.rule === "aisle-narrow")).toBe(true);
  });
});

describe("computeScore", () => {
  it("ideal layout yields high score", () => {
    expect(computeScore({ occupancy: 0.5, warnCount: 0, ngCount: 0 })).toBe(100);
  });
  it("ng penalises score", () => {
    expect(computeScore({ occupancy: 0.5, warnCount: 0, ngCount: 3 })).toBeLessThan(100);
  });
  it("score never negative", () => {
    expect(computeScore({ occupancy: 0.99, warnCount: 50, ngCount: 50 })).toBe(0);
  });
});
