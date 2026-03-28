import type { BuildingSettings } from "../types";

export const defaultBuildingSettings: BuildingSettings = {
  floors: 3,
  unitCount: 9,
  corridorType: "single",
  structureType: "wood",
  ceilingPlenumMm: 250,
  floorStepAllowanceMm: 120,
  gridSizeMm: 100,
};
