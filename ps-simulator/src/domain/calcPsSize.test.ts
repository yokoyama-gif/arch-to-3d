import { describe, it, expect } from "vitest";
import { calcPsSize } from "./calcPsSize";
import type { Fixture, PipeRoute } from "./types";

const ps: Fixture = {
  id: "ps1",
  type: "ps",
  x: 0,
  y: 0,
  w: 700,
  h: 500,
  rotation: 0,
  floor: 1,
};

function makeRoute(fixtureId: string, pipeType: PipeRoute["pipeType"]): PipeRoute {
  return {
    fixtureId,
    psId: ps.id,
    pipeType,
    lengthMm: 1000,
    points: [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ],
  };
}

describe("calcPsSize", () => {
  it("接続なしなら必要寸法0、ステータスok、本数も空", () => {
    const r = calcPsSize(ps, []);
    expect(r.requiredWidthMm).toBe(0);
    expect(r.requiredDepthMm).toBe(0);
    expect(r.status).toBe("ok");
    expect(r.pipeCounts).toEqual({});
  });

  it("同じ管種が複数戸から来る場合は本数分カウントされる", () => {
    const routes = [
      makeRoute("toilet1", "soil"),
      makeRoute("toilet2", "soil"),
      makeRoute("toilet3", "soil"),
    ];
    const r = calcPsSize(ps, routes);
    expect(r.pipeCounts).toEqual({ soil: 3 });
    // 3本の soil 管が積み上がるので、必要寸法は1本のときより大きくなるはず
    const single = calcPsSize(ps, [makeRoute("toilet1", "soil")]);
    expect(r.requiredDepthMm).toBeGreaterThan(single.requiredDepthMm);
  });

  it("複数管種混在のカウント", () => {
    const routes = [
      makeRoute("ub1", "waste"),
      makeRoute("ub1", "cold"),
      makeRoute("ub1", "hot"),
      makeRoute("k1", "waste"),
      makeRoute("k1", "cold"),
    ];
    const r = calcPsSize(ps, routes);
    expect(r.pipeCounts.waste).toBe(2);
    expect(r.pipeCounts.cold).toBe(2);
    expect(r.pipeCounts.hot).toBe(1);
  });

  it("PSが極端に小さいと ng になる", () => {
    const tiny: Fixture = { ...ps, w: 100, h: 100 };
    const r = calcPsSize(tiny, [
      makeRoute("toilet1", "soil"),
      makeRoute("toilet2", "soil"),
    ]);
    expect(r.status).toBe("ng");
  });

  it("pipeBreakdown に管種別 1本占有寸法と合計が含まれる", () => {
    const r = calcPsSize(ps, [
      makeRoute("t1", "soil"),
      makeRoute("t2", "soil"),
      makeRoute("ub1", "waste"),
    ]);
    expect(r.pipeBreakdown.soil).toBeDefined();
    expect(r.pipeBreakdown.soil!.count).toBe(2);
    expect(r.pipeBreakdown.soil!.perPipeMm).toBeGreaterThan(0);
    // 合計 = 1本占有 × 本数
    expect(r.pipeBreakdown.soil!.totalMm).toBe(
      r.pipeBreakdown.soil!.perPipeMm * 2
    );
    expect(r.pipeBreakdown.waste).toBeDefined();
    expect(r.pipeBreakdown.waste!.count).toBe(1);
  });
});
