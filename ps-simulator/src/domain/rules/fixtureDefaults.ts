import type { FixtureType } from "../types";

/** 設備ごとの初期寸法 (mm) */
export const fixtureDefaults: Record<FixtureType, { w: number; h: number }> = {
  toilet: { w: 800, h: 1600 },
  ub: { w: 1600, h: 1600 },
  washbasin: { w: 750, h: 600 },
  washing: { w: 800, h: 800 },
  kitchen: { w: 2100, h: 650 },
  ps: { w: 700, h: 500 },
  // 構造・図面参照要素
  column: { w: 105, h: 105 },   // 柱: 木造在来105×105
  beam: { w: 1820, h: 120 },    // 梁: 1間飛ばし×幅120
  wall: { w: 1820, h: 100 },    // 石膏ボード壁: 厚100
};

/** 設備の表示名 */
export const fixtureLabels: Record<FixtureType, string> = {
  toilet: "トイレ",
  ub: "UB",
  washbasin: "洗面台",
  washing: "洗濯パン",
  kitchen: "キッチン",
  ps: "PS",
  column: "柱",
  beam: "梁",
  wall: "石膏ボード",
};

/**
 * 設備内の排水口位置（矩形に対する相対比率 0..1）と排水口直径(mm)。
 * 該当しない設備（PS・構造系）は undefined。
 * 値は典型的な実物の位置をベースにした目安。
 */
export const fixtureDrainSpec: Partial<
  Record<FixtureType, { ratioX: number; ratioY: number; diameterMm: number }>
> = {
  // 便器の排水口は背面寄り中央
  toilet: { ratioX: 0.5, ratioY: 0.85, diameterMm: 100 },
  // UBの排水口は手前側に寄った位置
  ub: { ratioX: 0.5, ratioY: 0.8, diameterMm: 100 },
  // 洗面ボウル中央
  washbasin: { ratioX: 0.5, ratioY: 0.5, diameterMm: 60 },
  // 洗濯パンは中央
  washing: { ratioX: 0.5, ratioY: 0.5, diameterMm: 80 },
  // キッチンシンクは左寄り（一般的なシングルシンク想定）
  kitchen: { ratioX: 0.3, ratioY: 0.5, diameterMm: 80 },
};

/** 設備の表示色 */
export const fixtureColors: Record<FixtureType, string> = {
  toilet: "#c8e6c9",
  ub: "#bbdefb",
  washbasin: "#f8bbd0",
  washing: "#d1c4e9",
  kitchen: "#ffe0b2",
  ps: "#ffcc80",
  // 構造系は無彩色寄り
  column: "#616161",       // 柱: 濃灰（塗りつぶし）
  beam: "transparent",     // 梁: 塗りなし（点線で枠だけ描画）
  wall: "#eeeeee",         // 壁: 薄灰
};
