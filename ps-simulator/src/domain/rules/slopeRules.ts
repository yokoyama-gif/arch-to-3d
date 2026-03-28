import type { PipeType } from "../types";

/** 排水勾配の分母（1/N） soil=1/100, waste=1/50 */
export const slopeDenominators: Partial<Record<PipeType, number>> = {
  soil: 100,
  waste: 50,
};

/** 配管長さに基づく警告 / NG閾値 */
export const routeWarningRules = {
  wasteWarningLengthMm: 3000,
  wasteNgLengthMm: 5000,
  soilWarningLengthMm: 2000,
  soilNgLengthMm: 3500,
};
