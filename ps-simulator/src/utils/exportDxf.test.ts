import { describe, expect, it } from "vitest";
import { buildPlanDxf } from "./exportDxf";
import type { BuildingSettings, Fixture, PipeRoute } from "../domain/types";

const buildingSettings: BuildingSettings = {
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

const fixtures: Fixture[] = [
  {
    id: "toilet-1",
    type: "toilet",
    x: 900,
    y: 900,
    w: 800,
    h: 1600,
    rotation: 0,
    floor: 1,
  },
  {
    id: "ps-1",
    type: "ps",
    x: 3600,
    y: 900,
    w: 700,
    h: 500,
    rotation: 0,
    floor: 1,
  },
];

const routes: PipeRoute[] = [
  {
    fixtureId: "toilet-1",
    psId: "ps-1",
    pipeType: "soil",
    lengthMm: 3200,
    points: [
      { x: 1300, y: 2260 },
      { x: 3950, y: 2260 },
      { x: 3950, y: 1150 },
    ],
  },
];

describe("buildPlanDxf", () => {
  it("設備、排水口、配管、グリッドをDXF文字列に含める", () => {
    const dxf = buildPlanDxf({
      name: "案1",
      buildingSettings,
      fixtures,
      pipeRoutes: routes,
      backgroundImage: null,
      gridOffsetMm: { x: 0, y: 0 },
    });

    expect(dxf).toContain("SECTION");
    expect(dxf).toContain("GRID_MAJOR");
    expect(dxf).toContain("FIXTURE");
    expect(dxf).toContain("PS");
    expect(dxf).toContain("DRAIN");
    expect(dxf).toContain("PIPE_SOIL");
    expect(dxf).toContain("トイレ");
    expect(dxf).toContain("汚水");
    expect(dxf.trim().endsWith("EOF")).toBe(true);
  });

  it("背景枠とマーカーを出力できる", () => {
    const dxf = buildPlanDxf({
      name: "背景あり",
      buildingSettings,
      fixtures: [],
      pipeRoutes: [],
      backgroundImage: {
        dataUrl: "data:image/png;base64,xxx",
        x: 100,
        y: 200,
        widthMm: 42000,
        heightMm: 29700,
        opacity: 0.5,
        markers: [{ x: 500, y: 600 }],
      },
      gridOffsetMm: { x: 10, y: 20 },
    });

    expect(dxf).toContain("BACKGROUND_FRAME");
    expect(dxf).toContain("MARKER");
    expect(dxf).toContain("M1");
  });

  it("仕様で要求される全レイヤーを定義する", () => {
    const dxf = buildPlanDxf({
      name: "layers",
      buildingSettings,
      fixtures: [],
      pipeRoutes: [],
      backgroundImage: null,
      gridOffsetMm: { x: 0, y: 0 },
    });
    const required = [
      "GRID_MAJOR",
      "GRID_MINOR",
      "FIXTURE",
      "PS",
      "STRUCTURE",
      "DRAIN",
      "PIPE_SOIL",
      "PIPE_WASTE",
      "PIPE_VENT",
      "PIPE_COLD",
      "PIPE_HOT",
      "PIPE_GAS",
      "BACKGROUND_FRAME",
      "TEXT",
      "MARKER",
    ];
    for (const layer of required) expect(dxf).toContain(layer);
  });

  it("構造要素(柱/梁/壁)はSTRUCTUREレイヤーに乗る", () => {
    const structFixtures: Fixture[] = [
      {
        id: "col-1",
        type: "column",
        x: 100,
        y: 100,
        w: 105,
        h: 105,
        rotation: 0,
        floor: 1,
      },
      {
        id: "beam-1",
        type: "beam",
        x: 200,
        y: 100,
        w: 1820,
        h: 120,
        rotation: 0,
        floor: 1,
      },
    ];
    const dxf = buildPlanDxf({
      name: "struct",
      buildingSettings,
      fixtures: structFixtures,
      pipeRoutes: [],
      backgroundImage: null,
      gridOffsetMm: { x: 0, y: 0 },
    });
    expect(dxf).toMatch(/\n8\nSTRUCTURE\n/);
    expect(dxf).toContain("柱");
    expect(dxf).toContain("梁");
  });

  it("単位は mm ($INSUNITS=4)", () => {
    const dxf = buildPlanDxf({
      name: "units",
      buildingSettings,
      fixtures: [],
      pipeRoutes: [],
      backgroundImage: null,
      gridOffsetMm: { x: 0, y: 0 },
    });
    expect(dxf).toContain("$INSUNITS");
    // $INSUNITS の値が 4 (mm) であることを軽く確認
    const idx = dxf.indexOf("$INSUNITS");
    const around = dxf.substring(idx, idx + 40);
    expect(around).toMatch(/\n70\n4\n/);
  });
});
