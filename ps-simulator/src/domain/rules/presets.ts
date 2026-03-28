import type { BuildingSettings, Fixture } from "../types";
import { defaultBuildingSettings } from "./buildingDefaults";

export type Preset = {
  name: string;
  buildingSettings: BuildingSettings;
  defaultPsSize: { w: number; h: number };
  fixtures?: Fixture[];
};

export const presets: Preset[] = [
  {
    name: "木造3階共同住宅_単身1K標準",
    buildingSettings: { ...defaultBuildingSettings },
    defaultPsSize: { w: 700, h: 500 },
  },
  {
    name: "コンパクト優先",
    buildingSettings: {
      ...defaultBuildingSettings,
      floorStepAllowanceMm: 100,
    },
    defaultPsSize: { w: 650, h: 450 },
  },
  {
    name: "点検性優先",
    buildingSettings: {
      ...defaultBuildingSettings,
      floorStepAllowanceMm: 150,
    },
    defaultPsSize: { w: 800, h: 600 },
  },
];
