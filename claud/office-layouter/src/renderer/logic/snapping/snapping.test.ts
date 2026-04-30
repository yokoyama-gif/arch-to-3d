import { describe, it, expect } from "vitest";
import { clampToRoom, snapToGrid } from "./index";

describe("snapToGrid", () => {
  it("snaps to nearest multiple", () => {
    expect(snapToGrid(123, 100)).toBe(100);
    expect(snapToGrid(150, 100)).toBe(200);
    expect(snapToGrid(-30, 100)).toBe(-0); // -0 == 0
  });
  it("disabled when grid <= 0", () => {
    expect(snapToGrid(123, 0)).toBe(123);
  });
});

describe("clampToRoom", () => {
  it("keeps within bounds", () => {
    expect(clampToRoom(-100, 5, 200, 200, 1000, 1000)).toEqual({ x: 0, y: 5 });
    expect(clampToRoom(900, 900, 200, 200, 1000, 1000)).toEqual({ x: 800, y: 800 });
  });
});
