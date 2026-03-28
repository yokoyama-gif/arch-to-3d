import type { PipeSpec, PipeType, FixtureType } from "../types";

/** 管種ごとのスペック */
export const defaultPipeSpecs: Record<PipeType, PipeSpec> = {
  soil: { diameterMm: 100, insulationMm: 0, clearanceMm: 30 },
  waste: { diameterMm: 75, insulationMm: 10, clearanceMm: 30 },
  vent: { diameterMm: 75, insulationMm: 0, clearanceMm: 30 },
  cold: { diameterMm: 25, insulationMm: 20, clearanceMm: 20 },
  hot: { diameterMm: 20, insulationMm: 20, clearanceMm: 20 },
  gas: { diameterMm: 20, insulationMm: 0, clearanceMm: 20 },
};

/** 設備ごとの必要配管 */
export const fixturePipeMap: Record<Exclude<FixtureType, "ps">, PipeType[]> = {
  toilet: ["soil", "vent", "cold"],
  ub: ["waste", "cold", "hot"],
  washbasin: ["waste", "cold", "hot"],
  washing: ["waste", "cold"],
  kitchen: ["waste", "cold", "hot"],
};

/** 管種の表示名 */
export const pipeTypeLabels: Record<PipeType, string> = {
  soil: "汚水",
  waste: "雑排水",
  vent: "通気",
  cold: "給水",
  hot: "給湯",
  gas: "ガス",
};

/** 配管ルート表示色 */
export const pipeColors: Record<PipeType, string> = {
  soil: "#8B4513",
  waste: "#4a148c",
  vent: "#78909c",
  cold: "#1565c0",
  hot: "#c62828",
  gas: "#f9a825",
};
