import { describe, it, expect } from "vitest";
import { meetingSeats, occupancyRatio, totalSeats } from "./index";
import type { LayoutPlan } from "../../models/types";

function plan(): LayoutPlan {
  return {
    id: "p",
    name: "p",
    room: { width: 10000, height: 10000 },
    objects: [
      { id: "1", kind: "desk1", label: "x", x: 0, y: 0, width: 1200, height: 700, rotation: 0, seats: 1 },
      { id: "2", kind: "meeting-4", label: "m", x: 0, y: 0, width: 1800, height: 1200, rotation: 0, seats: 4 },
      { id: "3", kind: "storage", label: "s", x: 0, y: 0, width: 900, height: 450, rotation: 0 },
    ],
    zones: [],
  };
}

describe("seating", () => {
  it("totalSeats aggregates seats", () => {
    expect(totalSeats(plan())).toBe(5);
  });
  it("meetingSeats counts only meeting kinds", () => {
    expect(meetingSeats(plan())).toBe(4);
  });
  it("occupancyRatio respects bounds", () => {
    const r = occupancyRatio(plan());
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(1);
  });
});
