import type { PipeRoute, SlopeResult, RouteStatus } from "./types";
import { slopeDenominators, routeWarningRules } from "./rules/slopeRules";
import { pipeTypeLabels } from "./rules/pipeSpecs";

/**
 * 排水系配管ルートに対して勾配チェックを行う。
 * 給水・給湯・ガスなど排水系でない配管はスキップする。
 */
export function calcSlopeResults(
  routes: PipeRoute[],
  floorStepAllowanceMm: number
): SlopeResult[] {
  const results: SlopeResult[] = [];

  for (const route of routes) {
    const denominator = slopeDenominators[route.pipeType];
    if (denominator == null) continue; // 排水系のみ

    const requiredDropMm = route.lengthMm / denominator;
    const allowableDropMm = floorStepAllowanceMm;

    // 長さベースの判定
    let status: RouteStatus = "ok";
    if (route.pipeType === "waste") {
      if (route.lengthMm >= routeWarningRules.wasteNgLengthMm) status = "ng";
      else if (route.lengthMm >= routeWarningRules.wasteWarningLengthMm) status = "warning";
    } else if (route.pipeType === "soil") {
      if (route.lengthMm >= routeWarningRules.soilNgLengthMm) status = "ng";
      else if (route.lengthMm >= routeWarningRules.soilWarningLengthMm) status = "warning";
    }

    // 高低差が許容値を超える場合はNG
    if (requiredDropMm > allowableDropMm) {
      status = "ng";
    } else if (requiredDropMm > allowableDropMm * 0.8 && status === "ok") {
      status = "warning";
    }

    const label = pipeTypeLabels[route.pipeType] ?? route.pipeType;
    let message = `${label}: 横引${route.lengthMm}mm → 高低差${requiredDropMm.toFixed(0)}mm`;
    if (status === "ok") message += " (OK)";
    else if (status === "warning") message += " (注意)";
    else message += " (NG: 許容値超過)";

    results.push({
      fixtureId: route.fixtureId,
      pipeType: route.pipeType,
      lengthMm: route.lengthMm,
      requiredDropMm,
      allowableDropMm,
      status,
      message,
    });
  }

  return results;
}
