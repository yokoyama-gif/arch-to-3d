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
