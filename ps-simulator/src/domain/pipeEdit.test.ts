import { describe, it, expect } from "vitest";
import { calcPipeRoutes, orthogonalizePolyline } from "./calcPipeRoutes";
import { buildPlanDxf } from "../utils/exportDxf";
import type { Fixture, BuildingSettings, Point } from "./types";

const settings: BuildingSettings = {
  floors: 3,
  unitCount: 9,
  corridorType: "single",
  structureType: "wood",
  ceilingPlenumMm: 250,
  floorStepAllowanceMm: 120,
  moduleMm: 900,
  gridDivision: 4,
  gridSizeMm: 225,
};

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

const toilet: Fixture = {
  id: "t1",
  type: "toilet",
  x: 2000,
  y: 0,
  w: 800,
  h: 1600,
  rotation: 0,
  floor: 1,
};

describe("配管手動編集 (customPipePoints)", () => {
  it("customPipePointsが無い場合は自動L字ルートになる", () => {
    const routes = calcPipeRoutes([ps, toilet]);
    const soil = routes.find((r) => r.pipeType === "soil");
    expect(soil).toBeDefined();
    // 自動L字 = 3点 (from, corner, to)
    expect(soil!.points.length).toBe(3);
  });

  it("customPipePointsを設定するとlengthMmが増える(直交化込み)", () => {
    const auto = calcPipeRoutes([ps, toilet]);
    const autoSoil = auto.find((r) => r.pipeType === "soil")!;
    const autoLen = autoSoil.lengthMm;

    const toiletWithCustom: Fixture = {
      ...toilet,
      customPipePoints: {
        // 大きく回り道させる中間点 (絶対座標)
        soil: [
          { x: 5000, y: 5000 },
          { x: 5000, y: 200 },
        ],
      },
    };
    const custom = calcPipeRoutes([ps, toiletWithCustom]);
    const customSoil = custom.find((r) => r.pipeType === "soil")!;
    // 直交化により補助コーナーが追加される。少なくとも 4点以上(より長い経路)
    expect(customSoil.points.length).toBeGreaterThanOrEqual(4);
    expect(customSoil.lengthMm).toBeGreaterThan(autoLen);
  });

  it("customPipePointsを空配列にすると自動ルートと同じ長さに戻る", () => {
    const auto = calcPipeRoutes([ps, toilet]);
    const autoSoil = auto.find((r) => r.pipeType === "soil")!;

    const cleared: Fixture = {
      ...toilet,
      customPipePoints: { soil: [] },
    };
    const cleared2 = calcPipeRoutes([ps, cleared]);
    const clearedSoil = cleared2.find((r) => r.pipeType === "soil")!;
    // 空配列でも自動L字相当のルート
    expect(clearedSoil.lengthMm).toBeCloseTo(autoSoil.lengthMm, 0);
  });

  it("複数の中間点を経由するルートはユーザー指定点を全て通る", () => {
    const customToilet: Fixture = {
      ...toilet,
      customPipePoints: {
        soil: [
          { x: 1500, y: 800 },
          { x: 1500, y: 400 },
          { x: 1000, y: 400 },
        ],
      },
    };
    const routes = calcPipeRoutes([ps, customToilet]);
    const soil = routes.find((r) => r.pipeType === "soil")!;
    // 直交化されてもユーザー指定点は経路上に必ず含まれる
    const ptStrs = soil.points.map((p) => `${p.x},${p.y}`);
    expect(ptStrs).toContain("1500,800");
    expect(ptStrs).toContain("1500,400");
    expect(ptStrs).toContain("1000,400");
  });

  it("orthogonalizePolyline: 斜め線分はL字に分解される", () => {
    const result = orthogonalizePolyline([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ]);
    // 0,0 → 100,100 は斜め → 補助コーナー1点が入って3点
    expect(result.length).toBe(3);
    // 全ての隣接対が水平or垂直
    for (let i = 1; i < result.length; i++) {
      const dx = Math.abs(result[i].x - result[i - 1].x);
      const dy = Math.abs(result[i].y - result[i - 1].y);
      expect(dx < 0.5 || dy < 0.5).toBe(true);
    }
  });

  it("orthogonalizePolyline: 既に直交している線はそのまま", () => {
    const input: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 200 },
      { x: 50, y: 200 },
    ];
    const result = orthogonalizePolyline(input);
    expect(result).toEqual(input);
  });

  it("calcPipeRoutes の出力は全て直交セグメント", () => {
    const customToilet: Fixture = {
      ...toilet,
      customPipePoints: {
        soil: [
          { x: 5000, y: 5000 }, // 斜め経路
          { x: 1234, y: 567 },
        ],
      },
    };
    const routes = calcPipeRoutes([ps, customToilet]);
    for (const r of routes) {
      for (let i = 1; i < r.points.length; i++) {
        const dx = Math.abs(r.points[i].x - r.points[i - 1].x);
        const dy = Math.abs(r.points[i].y - r.points[i - 1].y);
        // どちらか一方が0(または0.5未満)なら直交
        expect(dx < 0.5 || dy < 0.5).toBe(true);
      }
    }
  });

  it("DXF出力に customPipePoints の折れ線が反映される", () => {
    const customToilet: Fixture = {
      ...toilet,
      customPipePoints: {
        soil: [
          { x: 5000, y: 5000 },
          { x: 5000, y: 200 },
        ],
      },
    };
    const routes = calcPipeRoutes([ps, customToilet]);
    const dxf = buildPlanDxf({
      name: "edited",
      buildingSettings: settings,
      fixtures: [ps, customToilet],
      pipeRoutes: routes,
      backgroundImage: null,
      gridOffsetMm: { x: 0, y: 0 },
    });
    // 編集された経路の中間点座標が DXF文字列に出ること
    expect(dxf).toContain("PIPE_SOIL");
    // 5000 という大きな座標が DXF に登場 (Y反転後でもどこかにある)
    expect(dxf).toMatch(/\n5000/);
  });
});
