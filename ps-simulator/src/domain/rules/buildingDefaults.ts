import type { BuildingSettings } from "../types";
import { computeGridSize } from "../types";

const DEFAULT_MODULE = 910 as const;       // 木造在来の標準モジュール
const DEFAULT_DIVISION = 2 as const;       // 1/2分割（455mm）

export const defaultBuildingSettings: BuildingSettings = {
  floors: 3,
  unitCount: 9,
  corridorType: "single",
  structureType: "wood",
  ceilingPlenumMm: 250,
  floorStepAllowanceMm: 120,
  moduleMm: DEFAULT_MODULE,
  gridDivision: DEFAULT_DIVISION,
  gridSizeMm: computeGridSize(DEFAULT_MODULE, DEFAULT_DIVISION),
};
