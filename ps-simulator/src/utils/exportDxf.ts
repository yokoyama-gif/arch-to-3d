import type {
  BackgroundImage,
  BuildingSettings,
  Fixture,
  PipeRoute,
  PipeType,
  Point,
} from "../domain/types";
import { fixtureDrainSpec, fixtureLabels } from "../domain/rules/fixtureDefaults";
import { pipeTypeLabels } from "../domain/rules/pipeSpecs";
import { CANVAS_DEFAULTS } from "../domain/rules/canvasDefaults";
import { structuralFixtureTypes } from "../domain/types";

/**
 * DXF出力モード:
 *  - "all": 設備+構造+配管+背景+グリッドすべて
 *  - "equipmentAndPipes": 設備と配管のみ(構造・背景・グリッド省略)
 *  - "pipesOnly": 配管経路のみ(他は補助情報として最小限)
 */
export type DxfExportMode = "all" | "equipmentAndPipes" | "pipesOnly";

export type DxfExportOptions = {
  mode: DxfExportMode;
  includeGrid: boolean;
  includeBackground: boolean;
  includeLabels: boolean;
};

export const DEFAULT_DXF_OPTIONS: DxfExportOptions = {
  mode: "all",
  includeGrid: true,
  includeBackground: true,
  includeLabels: true,
};

type DxfExportInput = {
  name: string;
  buildingSettings: BuildingSettings;
  fixtures: Fixture[];
  pipeRoutes: PipeRoute[];
  backgroundImage: BackgroundImage | null;
  gridOffsetMm: Point;
  options?: DxfExportOptions;
};

type DxfPoint = {
  x: number;
  y: number;
};

const PIPE_LAYER: Record<PipeType, string> = {
  soil: "PIPE_SOIL",
  waste: "PIPE_WASTE",
  vent: "PIPE_VENT",
  cold: "PIPE_COLD",
  hot: "PIPE_HOT",
  gas: "PIPE_GAS",
};

const LAYERS: Array<{ name: string; color: number }> = [
  { name: "0", color: 7 },
  { name: "BORDER", color: 8 },
  { name: "BACKGROUND_FRAME", color: 8 },
  { name: "GRID_MINOR", color: 9 },
  { name: "GRID_MAJOR", color: 8 },
  { name: "FIXTURE", color: 3 },
  { name: "PS", color: 30 },
  { name: "STRUCTURE", color: 8 },
  { name: "DRAIN", color: 1 },
  { name: "PIPE_SOIL", color: 32 },
  { name: "PIPE_WASTE", color: 6 },
  { name: "PIPE_VENT", color: 8 },
  { name: "PIPE_COLD", color: 5 },
  { name: "PIPE_HOT", color: 1 },
  { name: "PIPE_GAS", color: 2 },
  { name: "TEXT", color: 7 },
  { name: "MARKER", color: 1 },
];

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

function safeText(value: string): string {
  return value.replace(/[\r\n]/g, " ").trim();
}

function safeFileName(value: string): string {
  const name = value.trim() || "plan";
  return name.replace(/[\\/:*?"<>|]/g, "_");
}

function pair(code: number | string, value: number | string): string {
  return `${code}\n${value}\n`;
}

function toCadPoint(point: Point): DxfPoint {
  return {
    x: point.x,
    y: CANVAS_DEFAULTS.heightMm - point.y,
  };
}

function line(layer: string, a: Point, b: Point): string {
  const p1 = toCadPoint(a);
  const p2 = toCadPoint(b);
  return [
    pair(0, "LINE"),
    pair(8, layer),
    pair(10, formatNumber(p1.x)),
    pair(20, formatNumber(p1.y)),
    pair(30, 0),
    pair(11, formatNumber(p2.x)),
    pair(21, formatNumber(p2.y)),
    pair(31, 0),
  ].join("");
}

function rectangle(layer: string, x: number, y: number, w: number, h: number): string {
  return [
    line(layer, { x, y }, { x: x + w, y }),
    line(layer, { x: x + w, y }, { x: x + w, y: y + h }),
    line(layer, { x: x + w, y: y + h }, { x, y: y + h }),
    line(layer, { x, y: y + h }, { x, y }),
  ].join("");
}

function circle(layer: string, center: Point, radius: number): string {
  const p = toCadPoint(center);
  return [
    pair(0, "CIRCLE"),
    pair(8, layer),
    pair(10, formatNumber(p.x)),
    pair(20, formatNumber(p.y)),
    pair(30, 0),
    pair(40, formatNumber(radius)),
  ].join("");
}

function text(layer: string, insert: Point, height: number, value: string): string {
  const p = toCadPoint(insert);
  return [
    pair(0, "TEXT"),
    pair(8, layer),
    pair(10, formatNumber(p.x)),
    pair(20, formatNumber(p.y)),
    pair(30, 0),
    pair(40, formatNumber(height)),
    pair(1, safeText(value)),
  ].join("");
}

function routeLines(route: PipeRoute): string {
  const layer = PIPE_LAYER[route.pipeType];
  return route.points
    .slice(1)
    .map((point, index) => line(layer, route.points[index], point))
    .join("");
}

function fixtureLayer(fixture: Fixture): string {
  if (fixture.type === "ps") return "PS";
  if (structuralFixtureTypes.has(fixture.type)) return "STRUCTURE";
  return "FIXTURE";
}

function drainPosition(fixture: Fixture): { center: Point; radius: number } | null {
  const drain = fixtureDrainSpec[fixture.type];
  if (!drain) return null;
  return {
    center: {
      x: fixture.x + (fixture.drainOffsetMm?.x ?? fixture.w * drain.ratioX),
      y: fixture.y + (fixture.drainOffsetMm?.y ?? fixture.h * drain.ratioY),
    },
    radius: drain.diameterMm / 2,
  };
}

function layerTable(): string {
  return [
    pair(0, "TABLE"),
    pair(2, "LAYER"),
    pair(70, LAYERS.length),
    ...LAYERS.map(({ name, color }) =>
      [
        pair(0, "LAYER"),
        pair(2, name),
        pair(70, 0),
        pair(62, color),
        pair(6, "CONTINUOUS"),
      ].join("")
    ),
    pair(0, "ENDTAB"),
  ].join("");
}

function headerSection(): string {
  return [
    pair(0, "SECTION"),
    pair(2, "HEADER"),
    pair(9, "$ACADVER"),
    pair(1, "AC1009"),
    pair(9, "$INSUNITS"),
    pair(70, 4),
    pair(0, "ENDSEC"),
  ].join("");
}

function tablesSection(): string {
  return [pair(0, "SECTION"), pair(2, "TABLES"), layerTable(), pair(0, "ENDSEC")].join("");
}

function gridEntities(settings: BuildingSettings, gridOffsetMm: Point): string {
  const entities: string[] = [];
  const gridSize = settings.gridSizeMm;
  const division = settings.gridDivision;
  const startIxX = Math.floor((0 - gridOffsetMm.x) / gridSize);
  const endIxX = Math.ceil((CANVAS_DEFAULTS.widthMm - gridOffsetMm.x) / gridSize);
  const startIxY = Math.floor((0 - gridOffsetMm.y) / gridSize);
  const endIxY = Math.ceil((CANVAS_DEFAULTS.heightMm - gridOffsetMm.y) / gridSize);

  for (let i = startIxX; i <= endIxX; i++) {
    const x = gridOffsetMm.x + i * gridSize;
    if (x < 0 || x > CANVAS_DEFAULTS.widthMm) continue;
    const isMajor = ((i % division) + division) % division === 0;
    entities.push(line(isMajor ? "GRID_MAJOR" : "GRID_MINOR", { x, y: 0 }, { x, y: CANVAS_DEFAULTS.heightMm }));
  }

  for (let i = startIxY; i <= endIxY; i++) {
    const y = gridOffsetMm.y + i * gridSize;
    if (y < 0 || y > CANVAS_DEFAULTS.heightMm) continue;
    const isMajor = ((i % division) + division) % division === 0;
    entities.push(line(isMajor ? "GRID_MAJOR" : "GRID_MINOR", { x: 0, y }, { x: CANVAS_DEFAULTS.widthMm, y }));
  }

  return entities.join("");
}

function backgroundEntities(backgroundImage: BackgroundImage | null): string {
  if (!backgroundImage) return "";
  const markers = backgroundImage.markers ?? [];
  return [
    rectangle(
      "BACKGROUND_FRAME",
      backgroundImage.x,
      backgroundImage.y,
      backgroundImage.widthMm,
      backgroundImage.heightMm
    ),
    ...markers.map((marker, index) => {
      const center = { x: backgroundImage.x + marker.x, y: backgroundImage.y + marker.y };
      return [
        circle("MARKER", center, 80),
        text("TEXT", { x: center.x + 120, y: center.y - 120 }, 180, `M${index + 1}`),
      ].join("");
    }),
  ].join("");
}

function fixtureEntities(fixtures: Fixture[], includeLabels = true): string {
  return fixtures
    .map((fixture) => {
      const layer = fixtureLayer(fixture);
      const label = fixtureLabels[fixture.type] ?? fixture.type;
      const drain = drainPosition(fixture);
      return [
        rectangle(layer, fixture.x, fixture.y, fixture.w, fixture.h),
        includeLabels
          ? text("TEXT", { x: fixture.x + 80, y: fixture.y + 260 }, 220, label)
          : "",
        drain ? circle("DRAIN", drain.center, drain.radius) : "",
      ].join("");
    })
    .join("");
}

function pipeEntities(routes: PipeRoute[], includeLabels = true): string {
  return routes
    .map((route) => {
      const first = route.points[0];
      const label = pipeTypeLabels[route.pipeType] ?? route.pipeType;
      return [
        routeLines(route),
        includeLabels
          ? text("TEXT", { x: first.x + 80, y: first.y - 80 }, 160, label)
          : "",
      ].join("");
    })
    .join("");
}

function entitiesSection(input: DxfExportInput): string {
  const opts = input.options ?? DEFAULT_DXF_OPTIONS;
  const includeFixtures = opts.mode !== "pipesOnly";
  const includeStructures = opts.mode === "all";
  const includeGrid = opts.includeGrid && opts.mode === "all";
  const includeBg = opts.includeBackground && opts.mode === "all";

  // 「設備」と「構造要素」を分離してレイヤー出力対象を絞り込む
  const equipFixtures = input.fixtures.filter(
    (f) => !structuralFixtureTypes.has(f.type)
  );
  const structFixtures = input.fixtures.filter((f) =>
    structuralFixtureTypes.has(f.type)
  );

  return [
    pair(0, "SECTION"),
    pair(2, "ENTITIES"),
    rectangle("BORDER", 0, 0, CANVAS_DEFAULTS.widthMm, CANVAS_DEFAULTS.heightMm),
    includeGrid ? gridEntities(input.buildingSettings, input.gridOffsetMm) : "",
    includeBg ? backgroundEntities(input.backgroundImage) : "",
    includeFixtures ? fixtureEntities(equipFixtures, opts.includeLabels) : "",
    includeStructures ? fixtureEntities(structFixtures, opts.includeLabels) : "",
    pipeEntities(input.pipeRoutes, opts.includeLabels),
    pair(0, "ENDSEC"),
  ].join("");
}

export function buildPlanDxf(input: DxfExportInput): string {
  return [headerSection(), tablesSection(), entitiesSection(input), pair(0, "EOF")].join("");
}

export function exportPlanToDxf(input: DxfExportInput): void {
  const dxf = buildPlanDxf(input);
  const blob = new Blob([dxf], { type: "application/dxf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFileName(input.name)}.dxf`;
  a.click();
  URL.revokeObjectURL(url);
}
