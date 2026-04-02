import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  Plan,
  PlacedObject,
  Project,
  BoxPreset,
  JudgmentResult,
  CanvasState,
  ToolType,
  ViewMode,
  JudgmentSettings,
  RoomDefinition,
} from '../types';
import { defaultBoxPresets, defaultJudgmentSettings } from '../data/presets';

interface AppState {
  // プロジェクト
  project: Project;
  // 表示モード
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  // アクティブプラン
  activePlan: () => Plan;
  setActivePlan: (planId: string) => void;
  // キャンバス
  canvas: CanvasState;
  setCanvas: (partial: Partial<CanvasState>) => void;
  // ツール
  currentTool: ToolType;
  setTool: (tool: ToolType) => void;
  // 選択
  selectedObjectId: string | null;
  setSelectedObject: (id: string | null) => void;
  // 配置用プリセット
  placingPreset: BoxPreset | null;
  setPlacingPreset: (preset: BoxPreset | null) => void;
  // 配置用設備タイプ
  placingEquipment: { type: string; name: string; width: number; depth: number; height?: number; doorType?: string; doorSwing?: string; doorWidth?: number } | null;
  setPlacingEquipment: (eq: typeof AppState.prototype.placingEquipment) => void;
  // 部屋
  updateRoom: (room: Partial<RoomDefinition>) => void;
  // オブジェクト操作
  addObject: (obj: Omit<PlacedObject, 'id'>) => string;
  updateObject: (id: string, partial: Partial<PlacedObject>) => void;
  deleteObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  // 判定
  setJudgments: (judgments: JudgmentResult[]) => void;
  // プラン操作
  addPlan: (name?: string) => string;
  deletePlan: (planId: string) => void;
  renamePlan: (planId: string, name: string) => void;
  duplicatePlan: (planId: string) => string;
  updatePlanMemo: (planId: string, memo: string) => void;
  // 判定設定
  updateSettings: (settings: Partial<JudgmentSettings>) => void;
  // プリセット
  addUserPreset: (preset: BoxPreset) => void;
  deleteUserPreset: (id: string) => void;
  // プロジェクト
  updateProject: (partial: Partial<Pick<Project, 'name' | 'propertyName'>>) => void;
  // 保存・読込
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => boolean;
  exportProject: () => string;
  importProject: (json: string) => void;
  // テンプレート適用
  applyTemplate: (room: RoomDefinition, objects: Omit<PlacedObject, 'id'>[]) => void;
}

function createDefaultPlan(): Plan {
  return {
    id: uuidv4(),
    name: '案1',
    room: { name: 'エントランス', width: 3600, depth: 2700 },
    objects: [],
    judgments: [],
    settings: { ...defaultJudgmentSettings },
    memo: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createDefaultProject(): Project {
  const plan = createDefaultPlan();
  return {
    id: uuidv4(),
    name: '新規プロジェクト',
    propertyName: '',
    plans: [plan],
    activePlanId: plan.id,
    userPresets: [],
  };
}

export const useStore = create<AppState>((set, get) => ({
  project: createDefaultProject(),
  viewMode: 'plan',
  setViewMode: (mode) => set({ viewMode: mode }),

  activePlan: () => {
    const { project } = get();
    return project.plans.find((p) => p.id === project.activePlanId) || project.plans[0];
  },

  setActivePlan: (planId) =>
    set((state) => ({
      project: { ...state.project, activePlanId: planId },
      selectedObjectId: null,
    })),

  canvas: {
    zoom: 1,
    panX: 0,
    panY: 0,
    gridSize: 50,
    snapToGrid: true,
    snapToWall: true,
    showDimensions: true,
    showJudgments: true,
    showOperationSpace: true,
    showDoorSwing: true,
  },
  setCanvas: (partial) =>
    set((state) => ({ canvas: { ...state.canvas, ...partial } })),

  currentTool: 'select',
  setTool: (tool) => set({ currentTool: tool }),

  selectedObjectId: null,
  setSelectedObject: (id) => set({ selectedObjectId: id }),

  placingPreset: null,
  setPlacingPreset: (preset) =>
    set({ placingPreset: preset, placingEquipment: null, currentTool: preset ? 'place' : 'select' }),

  placingEquipment: null,
  setPlacingEquipment: (eq) =>
    set({ placingEquipment: eq, placingPreset: null, currentTool: eq ? 'place' : 'select' }),

  updateRoom: (room) =>
    set((state) => {
      const plans = state.project.plans.map((p) =>
        p.id === state.project.activePlanId
          ? { ...p, room: { ...p.room, ...room }, updatedAt: new Date().toISOString() }
          : p
      );
      return { project: { ...state.project, plans } };
    }),

  addObject: (obj) => {
    const id = uuidv4();
    set((state) => {
      const plans = state.project.plans.map((p) =>
        p.id === state.project.activePlanId
          ? { ...p, objects: [...p.objects, { ...obj, id }], updatedAt: new Date().toISOString() }
          : p
      );
      return { project: { ...state.project, plans } };
    });
    return id;
  },

  updateObject: (id, partial) =>
    set((state) => {
      const plans = state.project.plans.map((p) =>
        p.id === state.project.activePlanId
          ? {
              ...p,
              objects: p.objects.map((o) => (o.id === id ? { ...o, ...partial } : o)),
              updatedAt: new Date().toISOString(),
            }
          : p
      );
      return { project: { ...state.project, plans } };
    }),

  deleteObject: (id) =>
    set((state) => {
      const plans = state.project.plans.map((p) =>
        p.id === state.project.activePlanId
          ? { ...p, objects: p.objects.filter((o) => o.id !== id), updatedAt: new Date().toISOString() }
          : p
      );
      return {
        project: { ...state.project, plans },
        selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
      };
    }),

  duplicateObject: (id) => {
    const plan = get().activePlan();
    const obj = plan.objects.find((o) => o.id === id);
    if (!obj) return;
    get().addObject({ ...obj, x: obj.x + 100, y: obj.y + 100 });
  },

  setJudgments: (judgments) =>
    set((state) => {
      const plans = state.project.plans.map((p) =>
        p.id === state.project.activePlanId ? { ...p, judgments } : p
      );
      return { project: { ...state.project, plans } };
    }),

  addPlan: (name) => {
    const plan: Plan = {
      ...createDefaultPlan(),
      name: name || `案${get().project.plans.length + 1}`,
    };
    set((state) => ({
      project: {
        ...state.project,
        plans: [...state.project.plans, plan],
        activePlanId: plan.id,
      },
      selectedObjectId: null,
    }));
    return plan.id;
  },

  deletePlan: (planId) =>
    set((state) => {
      if (state.project.plans.length <= 1) return state;
      const plans = state.project.plans.filter((p) => p.id !== planId);
      const activePlanId =
        state.project.activePlanId === planId ? plans[0].id : state.project.activePlanId;
      return { project: { ...state.project, plans, activePlanId }, selectedObjectId: null };
    }),

  renamePlan: (planId, name) =>
    set((state) => ({
      project: {
        ...state.project,
        plans: state.project.plans.map((p) => (p.id === planId ? { ...p, name } : p)),
      },
    })),

  duplicatePlan: (planId) => {
    const source = get().project.plans.find((p) => p.id === planId);
    if (!source) return '';
    const newPlan: Plan = {
      ...JSON.parse(JSON.stringify(source)),
      id: uuidv4(),
      name: `${source.name} (コピー)`,
      objects: source.objects.map((o) => ({ ...o, id: uuidv4() })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({
      project: {
        ...state.project,
        plans: [...state.project.plans, newPlan],
        activePlanId: newPlan.id,
      },
      selectedObjectId: null,
    }));
    return newPlan.id;
  },

  updatePlanMemo: (planId, memo) =>
    set((state) => ({
      project: {
        ...state.project,
        plans: state.project.plans.map((p) => (p.id === planId ? { ...p, memo } : p)),
      },
    })),

  updateSettings: (settings) =>
    set((state) => {
      const plans = state.project.plans.map((p) =>
        p.id === state.project.activePlanId
          ? { ...p, settings: { ...p.settings, ...settings } }
          : p
      );
      return { project: { ...state.project, plans } };
    }),

  addUserPreset: (preset) =>
    set((state) => ({
      project: {
        ...state.project,
        userPresets: [...state.project.userPresets, { ...preset, isUserDefined: true }],
      },
    })),

  deleteUserPreset: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        userPresets: state.project.userPresets.filter((p) => p.id !== id),
      },
    })),

  updateProject: (partial) =>
    set((state) => ({ project: { ...state.project, ...partial } })),

  saveToLocalStorage: () => {
    const { project } = get();
    localStorage.setItem('takuhai-project', JSON.stringify(project));
  },

  loadFromLocalStorage: () => {
    const data = localStorage.getItem('takuhai-project');
    if (!data) return false;
    try {
      const project = JSON.parse(data) as Project;
      set({ project, selectedObjectId: null });
      return true;
    } catch {
      return false;
    }
  },

  exportProject: () => {
    return JSON.stringify(get().project, null, 2);
  },

  importProject: (json) => {
    try {
      const project = JSON.parse(json) as Project;
      set({ project, selectedObjectId: null });
    } catch (e) {
      console.error('Import failed:', e);
    }
  },

  applyTemplate: (room, objects) => {
    set((state) => {
      const plans = state.project.plans.map((p) =>
        p.id === state.project.activePlanId
          ? {
              ...p,
              room,
              objects: objects.map((o) => ({ ...o, id: uuidv4() })),
              updatedAt: new Date().toISOString(),
            }
          : p
      );
      return { project: { ...state.project, plans }, selectedObjectId: null };
    });
  },
}));

// allPresets helper
export function getAllPresets(userPresets: BoxPreset[]): BoxPreset[] {
  return [...defaultBoxPresets, ...userPresets];
}
