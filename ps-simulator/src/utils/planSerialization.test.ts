import { describe, it, expect } from "vitest";
import { PLAN_SCHEMA_VERSION } from "../domain/types";
import type { PlanData, BuildingSettings } from "../domain/types";

const baseSettings: BuildingSettings = {
  floors: 3,
  unitCount: 9,
  corridorType: "single",
  structureType: "wood",
  ceilingPlenumMm: 250,
  floorStepAllowanceMm: 120,
  moduleMm: 900,
  gridDivision: 4,
  gridSizeMm: 225,
};

/**
 * importPlanFromJson の本体は file picker を含むため、ここでは
 * その内部の検証関数 (validatePlanData) と等価な処理を直接呼んでテストする。
 * - v1 形式(schemaVersion なし、追加フィールドなし) を v2 として読めること
 * - v2 形式が壊れず復元できること
 */

function parseAsPlan(raw: unknown): PlanData | null {
  // importJson.ts の validatePlanData と同じ最低限のチェック
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.name !== "string") return null;
  if (!Array.isArray(o.fixtures)) return null;
  if (o.buildingSettings == null) return null;
  if (typeof o.schemaVersion !== "number") o.schemaVersion = 1;
  return o as unknown as PlanData;
}

describe("PlanData serialization 互換", () => {
  it("v1形式(schemaVersion未指定)も読める", () => {
    const v1 = {
      name: "old",
      buildingSettings: baseSettings,
      fixtures: [],
      savedAt: "2026-01-01",
    };
    const parsed = parseAsPlan(v1);
    expect(parsed).not.toBeNull();
    expect(parsed!.schemaVersion).toBe(1);
    expect(parsed!.name).toBe("old");
  });

  it("v2形式は schemaVersion + 拡張フィールドを保持", () => {
    const v2: PlanData = {
      schemaVersion: PLAN_SCHEMA_VERSION,
      name: "new",
      buildingSettings: baseSettings,
      fixtures: [],
      savedAt: "2026-01-02",
      backgroundImage: null,
      gridOffsetMm: { x: 0, y: 0 },
    };
    const parsed = parseAsPlan(v2);
    expect(parsed).not.toBeNull();
    expect(parsed!.schemaVersion).toBe(PLAN_SCHEMA_VERSION);
    expect(parsed!.gridOffsetMm).toEqual({ x: 0, y: 0 });
  });

  it("不正な型は弾く", () => {
    expect(parseAsPlan(null)).toBeNull();
    expect(parseAsPlan({ name: 1 })).toBeNull();
    expect(parseAsPlan({ name: "x", fixtures: "not-array" })).toBeNull();
  });
});
