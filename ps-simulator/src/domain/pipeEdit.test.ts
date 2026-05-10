import { describe, it, expect } from "vitest";
import { calcPipeRoutes } from "./calcPipeRoutes";
import { buildPlanDxf } from "../utils/exportDxf";
import type { Fixture, BuildingSettings } from "./types";

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

  it("customPipePointsを設定するとpointsとlengthMmが変わる", () => {
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
    expect(customSoil.points.length).toBe(4); // from + 2corner + to
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

  it("複数の中間点を経由するルートはpoints配列の順序を保持する", () => {
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
    // [from, ...3 corners, to] = 5点
    expect(soil.points.length).toBe(5);
    expect(soil.points[1]).toEqual({ x: 1500, y: 800 });
    expect(soil.points[2]).toEqual({ x: 1500, y: 400 });
    expect(soil.points[3]).toEqual({ x: 1000, y: 400 });
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
