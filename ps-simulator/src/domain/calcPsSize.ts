import type { Fixture, PipeRoute, PsResult, PipeType, RouteStatus } from "./types";
import { defaultPipeSpecs } from "./rules/pipeSpecs";
import { psRules } from "./rules/psRules";

/** 管1本の占有寸法 */
function occupiedSize(pipeType: PipeType): number {
  const spec = defaultPipeSpecs[pipeType];
  return spec.diameterMm + spec.insulationMm * 2 + spec.clearanceMm;
}

/**
 * PS内に収容すべき配管を集計し、必要PS寸法を概算する。
 */
export function calcPsSize(
  psFixture: Fixture,
  routes: PipeRoute[]
): PsResult {
  // このPSに接続する配管のタイプを重複除去して集める
  const pipeTypesSet = new Set<PipeType>();
  for (const r of routes) {
    if (r.psId === psFixture.id) {
      pipeTypesSet.add(r.pipeType);
    }
  }
  const pipeTypes = Array.from(pipeTypesSet);

  if (pipeTypes.length === 0) {
    return {
      psId: psFixture.id,
      requiredWidthMm: 0,
      requiredDepthMm: 0,
      recommendedWidthMm: 0,
      recommendedDepthMm: 0,
      status: "ok",
    };
  }

  // 各管の占有寸法
  const sizes = pipeTypes.map((pt) => occupiedSize(pt));
  const totalLinear = sizes.reduce((a, b) => a + b, 0);

  // --- 1列配置案 ---
  const oneColWidth = Math.max(...sizes) + psRules.outerMarginMm * 2;
  const oneColDepth = totalLinear + psRules.outerMarginMm * 2;

  // --- 2列配置案 ---
  let twoColWidth = 0;
  let twoColDepth = 0;
  if (psRules.allowTwoColumnLayout && pipeTypes.length >= 2) {
    // 大きい管と小さい管に分ける
    const sorted = [...sizes].sort((a, b) => b - a);
    const col1 = sorted.filter((_, i) => i % 2 === 0);
    const col2 = sorted.filter((_, i) => i % 2 === 1);
    const col1Max = Math.max(...col1, 0);
    const col2Max = col2.length > 0 ? Math.max(...col2) : 0;
    const col1Sum = col1.reduce((a, b) => a + b, 0);
    const col2Sum = col2.reduce((a, b) => a + b, 0);

    twoColWidth =
      col1Max + col2Max + psRules.minWorkingClearanceMm + psRules.outerMarginMm * 2;
    twoColDepth = Math.max(col1Sum, col2Sum) + psRules.outerMarginMm * 2;
  }

  // より合理的（面積が小さい）方を採用
  let requiredW: number;
  let requiredD: number;
  const oneArea = oneColWidth * oneColDepth;
  const twoArea = twoColWidth > 0 ? twoColWidth * twoColDepth : Infinity;

  if (twoArea < oneArea) {
    requiredW = twoColWidth;
    requiredD = twoColDepth;
  } else {
    requiredW = oneColWidth;
    requiredD = oneColDepth;
  }

  // 推奨寸法 = 最小必要 + 点検余裕
  const recommendedW = requiredW + psRules.inspectionExtraMm;
  const recommendedD = requiredD + psRules.inspectionExtraMm;

  // 実PS寸法との比較
  const actualW = psFixture.w;
  const actualD = psFixture.h;

  let status: RouteStatus = "ok";
  if (actualW < requiredW || actualD < requiredD) {
    status = "ng";
  } else if (actualW < recommendedW || actualD < recommendedD) {
    status = "warning";
  }

  return {
    psId: psFixture.id,
    requiredWidthMm: Math.round(requiredW),
    requiredDepthMm: Math.round(requiredD),
    recommendedWidthMm: Math.round(recommendedW),
    recommendedDepthMm: Math.round(recommendedD),
    status,
  };
}
