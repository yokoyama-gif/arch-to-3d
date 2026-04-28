/** 回転角度 */
export type Rotation = 0 | 90 | 180 | 270;

/** 2D座標 */
export type Point = {
  x: number;
  y: number;
};

/** 設備タイプ */
export type FixtureType =
  | "toilet"
  | "ub"
  | "washbasin"
  | "washing"
  | "kitchen"
  | "ps"
  // 構造・図面参照要素（配管ルート対象外）
  | "column"   // 柱
  | "beam"     // 梁（点線で表示）
  | "wall";    // 石膏ボード壁

/** 構造・図面参照系の要素種別（配管ルート計算から除外する） */
export const structuralFixtureTypes: ReadonlySet<FixtureType> = new Set([
  "column",
  "beam",
  "wall",
]);

/** 配管種別 */
export type PipeType = "soil" | "waste" | "vent" | "cold" | "hot" | "gas";

/** 判定ステータス */
export type RouteStatus = "ok" | "warning" | "ng";

/** 建物設定 */
export type BuildingSettings = {
  floors: number;
  unitCount: number;
  corridorType: "single" | "double";
  structureType: "wood" | "rc" | "steel";
  ceilingPlenumMm: number;
  floorStepAllowanceMm: number;
  gridSizeMm: number;
};

/** 設備要素 */
export type Fixture = {
  id: string;
  type: FixtureType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: Rotation;
  floor: number;
};

/** 配管要件 */
export type PipeRequirement = {
  pipeType: PipeType;
  diameterMm: number;
  insulationMm: number;
};

/** 配管ルート */
export type PipeRoute = {
  fixtureId: string;
  psId: string;
  pipeType: PipeType;
  lengthMm: number;
  points: Point[];
};

/** 配管スペック */
export type PipeSpec = {
  diameterMm: number;
  insulationMm: number;
  clearanceMm: number;
};

/** 勾配判定結果 */
export type SlopeResult = {
  fixtureId: string;
  pipeType: PipeType;
  lengthMm: number;
  requiredDropMm: number;
  allowableDropMm: number;
  status: RouteStatus;
  message: string;
};

/** PS寸法計算結果 */
export type PsResult = {
  psId: string;
  requiredWidthMm: number;
  requiredDepthMm: number;
  recommendedWidthMm: number;
  recommendedDepthMm: number;
  status: RouteStatus;
};

/** 案サマリ */
export type PlanSummary = {
  name: string;
  psAreaMm2: number;
  totalPipeLengthMm: number;
  warningCount: number;
  ngCount: number;
  maintenanceScore: number;
  constructabilityScore: number;
  totalScore: number;
};

/** 保存データ */
export type PlanData = {
  name: string;
  buildingSettings: BuildingSettings;
  fixtures: Fixture[];
  savedAt: string;
};
