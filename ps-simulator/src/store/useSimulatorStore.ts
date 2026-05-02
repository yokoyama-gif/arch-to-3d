import { create } from "zustand";
import type {
  BuildingSettings,
  Fixture,
  FixtureType,
  PipeRoute,
  PipeType,
  PipeDiameters,
  SlopeResult,
  PsResult,
  PlanSummary,
  PlanData,
  Rotation,
  BackgroundImage,
} from "../domain/types";
import { computeGridSize } from "../domain/types";
import { defaultBuildingSettings } from "../domain/rules/buildingDefaults";
import { fixtureDefaults } from "../domain/rules/fixtureDefaults";
import { defaultPipeSpecs } from "../domain/rules/pipeSpecs";
import { calcPipeRoutes } from "../domain/calcPipeRoutes";
import { calcSlopeResults } from "../domain/calcSlope";
import { calcPsSize } from "../domain/calcPsSize";
import { calcPlanSummary } from "../domain/scoring";
import { generateId } from "../utils/id";
import { snapToGrid, snapToGridWithOffset } from "../utils/geometry";

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
  /**
   * 配置済み座標で設備を追加する（グリッドスナップしない）。
   * 9点アンカー配置のように呼び出し側で位置計算済みのケース用。
   */
  addFixtureRaw: (type: FixtureType, x: number, y: number, w?: number, h?: number) => void;
  moveFixture: (id: string, x: number, y: number) => void;
  resizeFixture: (id: string, w: number, h: number) => void;
  /** ドラッグハンドルからのリサイズ用: 位置と寸法を一括更新 */
  setFixtureGeometry: (id: string, x: number, y: number, w: number, h: number) => void;
  /** 排水溝のオフセット位置を更新（設備左上からのmm） */
  setFixtureDrainOffset: (id: string, offsetX: number, offsetY: number) => void;
  /** 配管コーナー(中間点)を1点更新する */
  updateCustomPipePoint: (
    id: string,
    pipeType: PipeType,
    index: number,
    x: number,
    y: number
  ) => void;
  /** 配管に新しいコーナーを挿入する（既存配列の指定位置に） */
  insertCustomPipePoint: (
    id: string,
    pipeType: PipeType,
    index: number,
    x: number,
    y: number
  ) => void;
  /** 指定位置のコーナーを削除する */
  removeCustomPipePoint: (
    id: string,
    pipeType: PipeType,
    index: number
  ) => void;
  /** カスタム経路をクリアして自動L字ルートに戻す */
  clearCustomPipePoints: (id: string, pipeType: PipeType) => void;
  rotateFixture: (id: string) => void;
  deleteFixture: (id: string) => void;
  selectFixture: (id: string | null) => void;
  setFixtures: (fixtures: Fixture[]) => void;

  // グリッドの平行移動オフセット (mm)
  // 図面側は固定して、こちらの値を変えてグリッドの方を図面に合わせる仕様
  gridOffsetMm: { x: number; y: number };
  setGridOffset: (x: number, y: number) => void;
  nudgeGridOffset: (dx: number, dy: number) => void;
  /** マーカーの絶対座標にグリッド交点が来るようグリッドオフセットを設定 */
  alignGridByMarker: (markerIndex: number, gridSizeMm: number) => void;

  // 背景画像（平面図の下絵として表示）
  backgroundImage: BackgroundImage | null;
  setBackgroundImage: (img: BackgroundImage | null) => void;
  updateBackgroundImage: (patch: Partial<BackgroundImage>) => void;
  /** 背景画像にマーカー(柱中心など)を追加。座標は背景左上からのmmオフセット */
  addBackgroundMarker: (offsetX: number, offsetY: number) => void;
  /** 全マーカー削除 */
  clearBackgroundMarkers: () => void;
  /**
   * 指定インデックスのマーカーを最寄りグリッド交点に合わせるため、
   * 背景画像全体を必要分だけ平行移動する。
   */
  alignBackgroundByMarker: (markerIndex: number, gridSizeMm: number) => void;

  // 配管径設定 (横管・竪管ごとに編集可能)
  pipeDiameters: PipeDiameters;
  setPipeDiameter: (
    pipeType: PipeType,
    kind: "horizontal" | "riser",
    valueMm: number
  ) => void;

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

/**
 * 各管種のデフォルト径から PipeDiameters を生成。
 * 横管・竪管とも同径で初期化（必要に応じてユーザーが変更）。
 */
function createDefaultPipeDiameters(): PipeDiameters {
  const result = {} as PipeDiameters;
  (Object.keys(defaultPipeSpecs) as PipeType[]).forEach((pt) => {
    const d = defaultPipeSpecs[pt].diameterMm;
    result[pt] = { horizontalMm: d, riserMm: d };
  });
  return result;
}

/**
 * 初期は空のキャンバス。
 * ユーザーは
 *  1) 背景平面図をアップロード
 *  2) 2点指定でスケール校正
 *  3) その上に設備をパレットから配置
 * の流れで使う。
 */
function createInitialFixtures(): Fixture[] {
  return [];
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
      const off = get().gridOffsetMm;
      const defaults = fixtureDefaults[type];
      const newFixture: Fixture = {
        id: generateId(),
        type,
        x: snapToGridWithOffset(x, grid, off.x),
        y: snapToGridWithOffset(y, grid, off.y),
        w: defaults.w,
        h: defaults.h,
        rotation: 0,
        floor: 1,
      };
      set((state) => ({ fixtures: [...state.fixtures, newFixture] }));
      get().recalculate();
    },

    addFixtureRaw: (type, x, y, w, h) => {
      // スナップせず、指定座標・寸法でそのまま配置する
      const defaults = fixtureDefaults[type];
      const newFixture: Fixture = {
        id: generateId(),
        type,
        x,
        y,
        w: w ?? defaults.w,
        h: h ?? defaults.h,
        rotation: 0,
        floor: 1,
      };
      set((state) => ({ fixtures: [...state.fixtures, newFixture] }));
      get().recalculate();
    },

    moveFixture: (id, x, y) => {
      const grid = get().buildingSettings.gridSizeMm;
      const off = get().gridOffsetMm;
      set((state) => ({
        fixtures: state.fixtures.map((f) =>
          f.id === id
            ? {
                ...f,
                x: snapToGridWithOffset(x, grid, off.x),
                y: snapToGridWithOffset(y, grid, off.y),
              }
            : f
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

    updateCustomPipePoint: (id, pipeType, index, x, y) => {
      set((state) => ({
        fixtures: state.fixtures.map((f) => {
          if (f.id !== id) return f;
          const cur = f.customPipePoints?.[pipeType] ?? [];
          if (index < 0 || index >= cur.length) return f;
          const nextPts = [...cur];
          nextPts[index] = { x, y };
          return {
            ...f,
            customPipePoints: {
              ...(f.customPipePoints ?? {}),
              [pipeType]: nextPts,
            },
          };
        }),
      }));
      get().recalculate();
    },

    insertCustomPipePoint: (id, pipeType, index, x, y) => {
      set((state) => ({
        fixtures: state.fixtures.map((f) => {
          if (f.id !== id) return f;
          const cur = f.customPipePoints?.[pipeType] ?? [];
          const safeIndex = Math.max(0, Math.min(cur.length, index));
          const nextPts = [...cur];
          nextPts.splice(safeIndex, 0, { x, y });
          return {
            ...f,
            customPipePoints: {
              ...(f.customPipePoints ?? {}),
              [pipeType]: nextPts,
            },
          };
        }),
      }));
      get().recalculate();
    },

    removeCustomPipePoint: (id, pipeType, index) => {
      set((state) => ({
        fixtures: state.fixtures.map((f) => {
          if (f.id !== id) return f;
          const cur = f.customPipePoints?.[pipeType] ?? [];
          if (index < 0 || index >= cur.length) return f;
          const nextPts = cur.filter((_, i) => i !== index);
          return {
            ...f,
            customPipePoints: {
              ...(f.customPipePoints ?? {}),
              [pipeType]: nextPts,
            },
          };
        }),
      }));
      get().recalculate();
    },

    clearCustomPipePoints: (id, pipeType) => {
      set((state) => ({
        fixtures: state.fixtures.map((f) => {
          if (f.id !== id) return f;
          if (!f.customPipePoints) return f;
          const next = { ...f.customPipePoints };
          delete next[pipeType];
          return { ...f, customPipePoints: next };
        }),
      }));
      get().recalculate();
    },

    setFixtureDrainOffset: (id, offsetX, offsetY) => {
      // 設備の境界内にクランプ
      set((state) => ({
        fixtures: state.fixtures.map((f) => {
          if (f.id !== id) return f;
          const x = Math.max(0, Math.min(f.w, offsetX));
          const y = Math.max(0, Math.min(f.h, offsetY));
          return { ...f, drainOffsetMm: { x, y } };
        }),
      }));
      // 排水溝位置の変更は排水系配管の起点を変えるので、ルートを再計算する
      get().recalculate();
    },

    setFixtureGeometry: (id, x, y, w, h) => {
      // ドラッグハンドルからのリサイズ。位置はグリッド(オフセット込)にスナップ、
      // 寸法はグリッド倍数に丸める。
      const grid = get().buildingSettings.gridSizeMm;
      const off = get().gridOffsetMm;
      const minSize = 50;
      set((state) => ({
        fixtures: state.fixtures.map((f) =>
          f.id === id
            ? {
                ...f,
                x: snapToGridWithOffset(x, grid, off.x),
                y: snapToGridWithOffset(y, grid, off.y),
                w: Math.max(minSize, snapToGrid(w, grid)),
                h: Math.max(minSize, snapToGrid(h, grid)),
              }
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

    gridOffsetMm: { x: 0, y: 0 },
    setGridOffset: (x, y) => set({ gridOffsetMm: { x, y } }),
    nudgeGridOffset: (dx, dy) =>
      set((state) => ({
        gridOffsetMm: {
          x: state.gridOffsetMm.x + dx,
          y: state.gridOffsetMm.y + dy,
        },
      })),
    alignGridByMarker: (markerIndex, gridSizeMm) => {
      const bg = get().backgroundImage;
      if (!bg || !bg.markers || !bg.markers[markerIndex]) return;
      const m = bg.markers[markerIndex];
      // マーカーの絶対座標
      const absX = bg.x + m.x;
      const absY = bg.y + m.y;
      // 「値 = offset + n*step」となる offset を [0, step) に収める
      const mod = (v: number, s: number) => ((v % s) + s) % s;
      set({
        gridOffsetMm: {
          x: mod(absX, gridSizeMm),
          y: mod(absY, gridSizeMm),
        },
      });
    },

    backgroundImage: null,
    setBackgroundImage: (img) => set({ backgroundImage: img }),
    updateBackgroundImage: (patch) =>
      set((state) => ({
        backgroundImage: state.backgroundImage
          ? { ...state.backgroundImage, ...patch }
          : null,
      })),

    addBackgroundMarker: (offsetX, offsetY) =>
      set((state) => {
        if (!state.backgroundImage) return {};
        const next = [
          ...(state.backgroundImage.markers ?? []),
          { x: offsetX, y: offsetY },
        ];
        return {
          backgroundImage: { ...state.backgroundImage, markers: next },
        };
      }),

    clearBackgroundMarkers: () =>
      set((state) => {
        if (!state.backgroundImage) return {};
        return {
          backgroundImage: { ...state.backgroundImage, markers: [] },
        };
      }),

    alignBackgroundByMarker: (markerIndex, gridSizeMm) => {
      const bg = get().backgroundImage;
      if (!bg || !bg.markers || !bg.markers[markerIndex]) return;
      const m = bg.markers[markerIndex];
      // マーカーの絶対座標
      const absX = bg.x + m.x;
      const absY = bg.y + m.y;
      // 最寄りグリッド交点
      const gx = Math.round(absX / gridSizeMm) * gridSizeMm;
      const gy = Math.round(absY / gridSizeMm) * gridSizeMm;
      // 背景全体を平行移動 (マーカーは bg.x からの相対なので追従する)
      set({
        backgroundImage: {
          ...bg,
          x: bg.x + (gx - absX),
          y: bg.y + (gy - absY),
        },
      });
    },

    pipeDiameters: createDefaultPipeDiameters(),
    setPipeDiameter: (pipeType, kind, valueMm) => {
      const sanitized = Math.max(10, Math.min(300, valueMm));
      set((state) => ({
        pipeDiameters: {
          ...state.pipeDiameters,
          [pipeType]: {
            ...state.pipeDiameters[pipeType],
            [kind === "horizontal" ? "horizontalMm" : "riserMm"]: sanitized,
          },
        },
      }));
      // 径変更は描画のみに影響（ルート/勾配計算は変わらない）。recalculate不要。
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
