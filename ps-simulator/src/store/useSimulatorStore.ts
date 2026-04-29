import { create } from "zustand";
import type {
  BuildingSettings,
  Fixture,
  FixtureType,
  PipeRoute,
  SlopeResult,
  PsResult,
  PlanSummary,
  PlanData,
  Rotation,
} from "../domain/types";
import { computeGridSize } from "../domain/types";
import { defaultBuildingSettings } from "../domain/rules/buildingDefaults";
import { fixtureDefaults } from "../domain/rules/fixtureDefaults";
import { calcPipeRoutes } from "../domain/calcPipeRoutes";
import { calcSlopeResults } from "../domain/calcSlope";
import { calcPsSize } from "../domain/calcPsSize";
import { calcPlanSummary } from "../domain/scoring";
import { generateId } from "../utils/id";
import { snapToGrid } from "../utils/geometry";

type SavedPlan = {
  name: string;
  summary: PlanSummary;
  data: PlanData;
};

type SimulatorState = {
  // 建物設定
  buildingSettings: BuildingSettings;
  setBuildingSettings: (s: Partial<BuildingSettings>) => void;

  // 設備
  fixtures: Fixture[];
  selectedFixtureId: string | null;
  addFixture: (type: FixtureType, x: number, y: number) => void;
  moveFixture: (id: string, x: number, y: number) => void;
  resizeFixture: (id: string, w: number, h: number) => void;
  rotateFixture: (id: string) => void;
  deleteFixture: (id: string) => void;
  selectFixture: (id: string | null) => void;
  setFixtures: (fixtures: Fixture[]) => void;

  // 計算結果（派生）
  pipeRoutes: PipeRoute[];
  slopeResults: SlopeResult[];
  psResults: PsResult[];
  recalculate: () => void;

  // 案管理
  currentPlanName: string;
  setCurrentPlanName: (name: string) => void;
  savedPlans: SavedPlan[];
  savePlan: () => void;
  deleteSavedPlan: (name: string) => void;

  // JSON保存/読込
  exportPlanData: () => PlanData;
  importPlanData: (data: PlanData) => void;
};

// ダミー初期配置
function createInitialFixtures(): Fixture[] {
  return [
    { id: generateId(), type: "ps", x: 0, y: 0, w: 700, h: 500, rotation: 0, floor: 1 },
    { id: generateId(), type: "toilet", x: 800, y: 0, w: 800, h: 1600, rotation: 0, floor: 1 },
    { id: generateId(), type: "ub", x: 1700, y: 0, w: 1600, h: 1600, rotation: 0, floor: 1 },
    { id: generateId(), type: "washbasin", x: 800, y: 1700, w: 750, h: 600, rotation: 0, floor: 1 },
    { id: generateId(), type: "washing", x: 1600, y: 1700, w: 800, h: 800, rotation: 0, floor: 1 },
    { id: generateId(), type: "kitchen", x: 0, y: 2500, w: 2100, h: 650, rotation: 0, floor: 1 },
  ];
}

export const useSimulatorStore = create<SimulatorState>((set, get) => {
  const initialFixtures = createInitialFixtures();
  const initialRoutes = calcPipeRoutes(initialFixtures);
  const initialSlope = calcSlopeResults(initialRoutes, defaultBuildingSettings.floorStepAllowanceMm);
  const psList = initialFixtures.filter((f) => f.type === "ps");
  const initialPsResults = psList.map((ps) => calcPsSize(ps, initialRoutes));

  return {
    buildingSettings: { ...defaultBuildingSettings },
    setBuildingSettings: (s) => {
      set((state) => {
        const merged = { ...state.buildingSettings, ...s };
        // moduleMm または gridDivision が変わった場合、gridSizeMm を再計算
        if (s.moduleMm !== undefined || s.gridDivision !== undefined) {
          merged.gridSizeMm = computeGridSize(merged.moduleMm, merged.gridDivision);
        }
        return { buildingSettings: merged };
      });
      get().recalculate();
    },

    fixtures: initialFixtures,
    selectedFixtureId: null,

    addFixture: (type, x, y) => {
      const grid = get().buildingSettings.gridSizeMm;
      const defaults = fixtureDefaults[type];
      const newFixture: Fixture = {
        id: generateId(),
        type,
        x: snapToGrid(x, grid),
        y: snapToGrid(y, grid),
        w: defaults.w,
        h: defaults.h,
        rotation: 0,
        floor: 1,
      };
      set((state) => ({ fixtures: [...state.fixtures, newFixture] }));
      get().recalculate();
    },

    moveFixture: (id, x, y) => {
      const grid = get().buildingSettings.gridSizeMm;
      set((state) => ({
        fixtures: state.fixtures.map((f) =>
          f.id === id ? { ...f, x: snapToGrid(x, grid), y: snapToGrid(y, grid) } : f
        ),
      }));
      get().recalculate();
    },

    resizeFixture: (id, w, h) => {
      // snapToGridを使わず、ユーザー入力値をそのまま反映する
      // （入力途中にグリッド丸めすると数字が打てなくなるため）
      set((state) => ({
        fixtures: state.fixtures.map((f) =>
          f.id === id
            ? { ...f, w: Math.max(50, w), h: Math.max(50, h) }
            : f
        ),
      }));
      get().recalculate();
    },

    rotateFixture: (id) => {
      set((state) => ({
        fixtures: state.fixtures.map((f) => {
          if (f.id !== id) return f;
          const nextRotation = ((f.rotation + 90) % 360) as Rotation;
          // 中心座標を維持しながらw/hを入れ替え
          const cx = f.x + f.w / 2;
          const cy = f.y + f.h / 2;
          const newW = f.h;
          const newH = f.w;
          return {
            ...f,
            rotation: nextRotation,
            w: newW,
            h: newH,
            x: cx - newW / 2,
            y: cy - newH / 2,
          };
        }),
      }));
      get().recalculate();
    },

    deleteFixture: (id) => {
      set((state) => ({
        fixtures: state.fixtures.filter((f) => f.id !== id),
        selectedFixtureId:
          state.selectedFixtureId === id ? null : state.selectedFixtureId,
      }));
      get().recalculate();
    },

    selectFixture: (id) => set({ selectedFixtureId: id }),

    setFixtures: (fixtures) => {
      set({ fixtures });
      get().recalculate();
    },

    pipeRoutes: initialRoutes,
    slopeResults: initialSlope,
    psResults: initialPsResults,

    recalculate: () => {
      const { fixtures, buildingSettings } = get();
      const routes = calcPipeRoutes(fixtures);
      const slope = calcSlopeResults(routes, buildingSettings.floorStepAllowanceMm);
      const psList = fixtures.filter((f) => f.type === "ps");
      const psResults = psList.map((ps) => calcPsSize(ps, routes));
      set({ pipeRoutes: routes, slopeResults: slope, psResults });
    },

    currentPlanName: "案1",
    setCurrentPlanName: (name) => set({ currentPlanName: name }),

    savedPlans: [],
    savePlan: () => {
      const state = get();
      const summary = calcPlanSummary(
        state.currentPlanName,
        state.fixtures,
        state.pipeRoutes,
        state.slopeResults,
        state.psResults
      );
      const data: PlanData = {
        name: state.currentPlanName,
        buildingSettings: state.buildingSettings,
        fixtures: state.fixtures,
        savedAt: new Date().toISOString(),
      };
      set((s) => {
        // 同名なら上書き
        const filtered = s.savedPlans.filter((p) => p.name !== state.currentPlanName);
        return { savedPlans: [...filtered, { name: state.currentPlanName, summary, data }] };
      });
    },

    deleteSavedPlan: (name) => {
      set((s) => ({
        savedPlans: s.savedPlans.filter((p) => p.name !== name),
      }));
    },

    exportPlanData: () => {
      const state = get();
      return {
        name: state.currentPlanName,
        buildingSettings: state.buildingSettings,
        fixtures: state.fixtures,
        savedAt: new Date().toISOString(),
      };
    },

    importPlanData: (data) => {
      set({
        currentPlanName: data.name,
        buildingSettings: data.buildingSettings,
        fixtures: data.fixtures,
      });
      get().recalculate();
    },
  };
});
