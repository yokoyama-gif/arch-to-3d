import { describe, it, expect } from "vitest";
import {
  aisleGap,
  expandRect,
  intersectionArea,
  isOutOfRoom,
  objectAABB,
  rectsOverlap,
} from "./rect";
import type { LayoutObject } from "../../models/types";

const baseObj: LayoutObject = {
  id: "a",
  kind: "desk1",
  label: "desk",
  x: 0,
  y: 0,
  width: 1200,
  height: 700,
  rotation: 0,
};

describe("objectAABB", () => {
  it("returns same dimensions when rotation is 0/180", () => {
    expect(objectAABB({ ...baseObj, rotation: 0 })).toEqual({ x: 0, y: 0, width: 1200, height: 700 });
    expect(objectAABB({ ...baseObj, rotation: 180 })).toEqual({ x: 0, y: 0, width: 1200, height: 700 });
  });
  it("swaps dimensions when rotation is 90/270", () => {
    expect(objectAABB({ ...baseObj, rotation: 90 })).toEqual({ x: 0, y: 0, width: 700, height: 1200 });
    expect(objectAABB({ ...baseObj, rotation: 270 })).toEqual({ x: 0, y: 0, width: 700, height: 1200 });
  });
});

describe("rectsOverlap / intersectionArea", () => {
  it("detects overlap", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 50, y: 50, width: 100, height: 100 };
    expect(rectsOverlap(a, b)).toBe(true);
    expect(intersectionArea(a, b)).toBe(2500);
  });
  it("detects non-overlap including touching edges", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 100, y: 0, width: 100, height: 100 };
    expect(rectsOverlap(a, b)).toBe(false);
    expect(intersectionArea(a, b)).toBe(0);
  });
});

describe("isOutOfRoom", () => {
  const room = { width: 1000, height: 1000 };
  it("inside", () => {
    expect(isOutOfRoom({ x: 0, y: 0, width: 1000, height: 1000 }, room)).toBe(false);
  });
  it("outside", () => {
    expect(isOutOfRoom({ x: -1, y: 0, width: 100, height: 100 }, room)).toBe(true);
    expect(isOutOfRoom({ x: 0, y: 0, width: 1001, height: 100 }, room)).toBe(true);
  });
});

describe("expandRect", () => {
  it("adds padding to each side", () => {
    expect(expandRect({ x: 100, y: 100, width: 200, height: 200 }, 50)).toEqual({
      x: 50,
      y: 50,
      width: 300,
      height: 300,
    });
  });
});

describe("aisleGap", () => {
  it("returns horizontal gap when y overlap exists", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 200, y: 50, width: 100, height: 100 };
    expect(aisleGap(a, b, "x")).toBe(100);
  });
  it("returns Infinity when y does not overlap", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 200, y: 200, width: 100, height: 100 };
    expect(aisleGap(a, b, "x")).toBe(Infinity);
  });
});
