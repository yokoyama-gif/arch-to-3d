import type { Fixture, PipeRoute, SlopeResult, PsResult, PlanSummary } from "./types";
import { scoringWeights, maintenanceRules } from "./rules/scoringRules";

/**
 * 案のサマリ / スコアを計算する。
 * スコアは0〜100の範囲で算出する。高い方が良い。
 */
export function calcPlanSummary(
  name: string,
  fixtures: Fixture[],
  routes: PipeRoute[],
  slopeResults: SlopeResult[],
  psResults: PsResult[]
): PlanSummary {
  // --- 基礎集計 ---
  const psList = fixtures.filter((f) => f.type === "ps");
  const psAreaMm2 = psList.reduce((sum, p) => sum + p.w * p.h, 0);
  const totalPipeLengthMm = routes.reduce((sum, r) => sum + r.lengthMm, 0);
  const warningCount = slopeResults.filter((s) => s.status === "warning").length;
  const ngCount = slopeResults.filter((s) => s.status === "ng").length;

  // --- PS面積スコア (小さいほど良い, 上限 1,000,000mm2) ---
  const psAreaScore = Math.max(0, 100 - (psAreaMm2 / 10000));

  // --- 配管総延長スコア (短いほど良い, 上限 50,000mm) ---
  const pipeLengthScore = Math.max(0, 100 - (totalPipeLengthMm / 500));

  // --- 勾配ペナルティスコア ---
  const slopePenalty = Math.max(0, 100 - warningCount * 10 - ngCount * 30);

  // --- 点検性スコア ---
  let maintenanceScore = 100;
  for (const ps of psList) {
    if (ps.w < maintenanceRules.recommendedMinPsWidthMm ||
        ps.h < maintenanceRules.recommendedMinPsDepthMm) {
      maintenanceScore -= 30;
    } else if (ps.w < maintenanceRules.goodPsWidthMm ||
               ps.h < maintenanceRules.goodPsDepthMm) {
      maintenanceScore -= 10;
    }
  }
  // PS判定からも加味
  for (const psr of psResults) {
    if (psr.status === "ng") maintenanceScore -= 20;
    else if (psr.status === "warning") maintenanceScore -= 10;
  }
  maintenanceScore = Math.max(0, maintenanceScore);

  // --- 施工性スコア（配管長さ＋勾配に基づく簡易指標） ---
  const constructabilityScore = Math.round(
    pipeLengthScore * 0.5 + slopePenalty * 0.5
  );

  // --- 総合スコア ---
  const totalScore = Math.round(
    psAreaScore * scoringWeights.psArea +
    pipeLengthScore * scoringWeights.totalPipeLength +
    slopePenalty * scoringWeights.slopePenalty +
    maintenanceScore * scoringWeights.maintenance
  );

  return {
    name,
    psAreaMm2,
    totalPipeLengthMm,
    warningCount,
    ngCount,
    maintenanceScore: Math.round(maintenanceScore),
    constructabilityScore,
    totalScore: Math.min(100, Math.max(0, totalScore)),
  };
}
