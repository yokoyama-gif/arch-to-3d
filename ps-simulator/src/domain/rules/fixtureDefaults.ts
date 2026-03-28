import type { FixtureType } from "../types";

/** 設備ごとの初期寸法 (mm) */
export const fixtureDefaults: Record<FixtureType, { w: number; h: number }> = {
  toilet: { w: 800, h: 1600 },
  ub: { w: 1600, h: 1600 },
  washbasin: { w: 750, h: 600 },
  washing: { w: 800, h: 800 },
  kitchen: { w: 2100, h: 650 },
  ps: { w: 700, h: 500 },
};

/** 設備の表示名 */
export const fixtureLabels: Record<FixtureType, string> = {
  toilet: "トイレ",
  ub: "UB",
  washbasin: "洗面台",
  washing: "洗濯パン",
  kitchen: "キッチン",
  ps: "PS",
};

/** 設備の表示色 */
export const fixtureColors: Record<FixtureType, string> = {
  toilet: "#c8e6c9",
  ub: "#bbdefb",
  washbasin: "#f8bbd0",
  washing: "#d1c4e9",
  kitchen: "#ffe0b2",
  ps: "#ffcc80",
};
