import type { BuildingSettings, Fixture } from "../types";
import { computeGridSize } from "../types";
import { defaultBuildingSettings } from "./buildingDefaults";

export type Preset = {
  name: string;
  buildingSettings: BuildingSettings;
  defaultPsSize: { w: number; h: number };
  fixtures?: Fixture[];
};

export const presets: Preset[] = [
  {
    // 木造910モジュールの標準（455グリッド）
    name: "木造3階共同住宅_単身1K標準",
    buildingSettings: { ...defaultBuildingSettings },
    defaultPsSize: { w: 700, h: 500 },
  },
  {
    // 1/4分割（227.5）で細かく見るコンパクト案
    name: "コンパクト優先",
    buildingSettings: {
      ...defaultBuildingSettings,
      floorStepAllowanceMm: 100,
      moduleMm: 910,
      gridDivision: 4,
      gridSizeMm: computeGridSize(910, 4),
    },
    defaultPsSize: { w: 650, h: 450 },
  },
  {
    // 1000モジュール×1/2分割（500）の点検性優先
    name: "点検性優先",
    buildingSettings: {
      ...defaultBuildingSettings,
      floorStepAllowanceMm: 150,
      moduleMm: 1000,
      gridDivision: 2,
      gridSizeMm: computeGridSize(1000, 2),
    },
    defaultPsSize: { w: 800, h: 600 },
  },
];
