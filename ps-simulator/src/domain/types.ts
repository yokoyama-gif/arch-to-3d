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

/** 木造設計でよく使う基準モジュール (mm) */
export type ModuleMm = 900 | 910 | 1000;

/** モジュール分割数 */
export type GridDivision = 2 | 3 | 4 | 6;

/** 選択可能なモジュール一覧 */
export const MODULE_OPTIONS: ModuleMm[] = [900, 910, 1000];

/** 選択可能な分割数一覧（1/2, 1/3, 1/4, 1/6） */
export const GRID_DIVISION_OPTIONS: GridDivision[] = [2, 3, 4, 6];

/** 建物設定 */
export type BuildingSettings = {
  floors: number;
  unitCount: number;
  corridorType: "single" | "double";
  structureType: "wood" | "rc" | "steel";
  ceilingPlenumMm: number;
  floorStepAllowanceMm: number;
  /** 基準モジュール (mm) */
  moduleMm: ModuleMm;
  /** モジュール分割数 (2,3,4,6) */
  gridDivision: GridDivision;
  /**
   * 実際のグリッド寸法 (mm)。moduleMm / gridDivision で算出される派生値だが、
   * 既存のロジックや保存形式との互換のためフィールドとして保持する。
   */
  gridSizeMm: number;
};

/** モジュールと分割数からグリッド寸法を計算 */
export function computeGridSize(
  moduleMm: ModuleMm,
  division: GridDivision
): number {
  // 1/6分割など割り切れない場合に備えて小数1桁まで丸める
  return Math.round((moduleMm / division) * 10) / 10;
}

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
  /**
   * 排水溝の位置オフセット（設備の左上からのmm距離）。
   * 未指定の場合は fixtureDrainSpec の比率からデフォルト位置で表示される。
   */
  drainOffsetMm?: Point;
  /**
   * 配管ルート中間点の上書き（管種ごと）。絶対座標(mm)の配列。
   * 未指定または空なら自動L字ルートを使う。
   * 配列なら from → points[0] → points[1] → ... → to の経路で接続。
   * ユーザーが横管をドラッグで曲げたり、新しいコーナーを追加した場合に保持。
   */
  customPipePoints?: Partial<Record<PipeType, Point[]>>;
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

/** 背景画像（PDF読込結果も含む）の設定 */
export type BackgroundImage = {
  /** dataURL (image/png 等) */
  dataUrl: string;
  /** 表示時の左上位置 (mm) */
  x: number;
  /** 表示時の左上位置 (mm) */
  y: number;
  /** 表示幅 (mm)。元画像のピクセル数 × 任意の縮尺 */
  widthMm: number;
  /** 表示高さ (mm) */
  heightMm: number;
  /** 不透明度 0..1 */
  opacity: number;
  /** 白黒(グレースケール)で表示するか */
  grayscale?: boolean;
  /**
   * 柱マーク等の参照点。背景画像の左上(x,y)からのmmオフセット。
   * 図面を平行移動してもマークは図面に追従する。
   */
  markers?: Point[];
};

/** 配管径(横管・竪管)のペア */
export type PipeDiameterPair = {
  /** 横管(横引き)の外径 mm */
  horizontalMm: number;
  /** 竪管(立て管)の外径 mm */
  riserMm: number;
};

/** 全管種ごとの径設定 */
export type PipeDiameters = Record<PipeType, PipeDiameterPair>;

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
