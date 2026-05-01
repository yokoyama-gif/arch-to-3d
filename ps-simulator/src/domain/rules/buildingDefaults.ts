import type { BuildingSettings } from "../types";
import { computeGridSize } from "../types";

const DEFAULT_MODULE = 900 as const;       // メーターモジュール
const DEFAULT_DIVISION = 4 as const;       // 1/4分割（225mm）

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
