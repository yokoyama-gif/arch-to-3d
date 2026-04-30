import { create } from "zustand";
import type {
  ID,
  LayoutObject,
  LayoutPlan,
  Project,
  ProjectSettings,
  Room,
} from "../models/types";
import { libraryItemByKind } from "../models/presets";
import { snapToGrid, clampToRoom } from "../logic/snapping";

const DEFAULT_SETTINGS: ProjectSettings = {
  gridSize: 100,
  minAisleWidth: 1200,
  showGrid: true,
  snapToGrid: true,
  unit: "mm",
};

function genId(prefix: string): ID {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createEmptyPlan(name: string, room: Room): LayoutPlan {
  return {
    id: genId("plan"),
    name,
    room,
    objects: [],
    zones: [],
  };
}

function createEmptyProject(): Project {
  const plan = createEmptyPlan("案1", { width: 12000, height: 8000 });
  const now = new Date().toISOString();
  return {
    id: genId("proj"),
    name: "新規プロジェクト",
    createdAt: now,
    updatedAt: now,
    settings: { ...DEFAULT_SETTINGS },
    plans: [plan],
    activePlanId: plan.id,
  };
}

interface ProjectStore {
  project: Project;
  selectedObjectId: ID | null;

  // selectors (computed via getters)
  activePlan: () => LayoutPlan;

  // mutations
  setProject: (project: Project) => void;
  resetProject: () => void;
  setProjectName: (name: string) => void;
  setRoomSize: (width: number, height: number) => void;
  setSettings: (patch: Partial<ProjectSettings>) => void;

  addObjectFromKind: (kind: string, x?: number, y?: number) => void;
  updateObject: (id: ID, patch: Partial<LayoutObject>) => void;
  moveObject: (id: ID, x: number, y: number) => void;
  rotateObject: (id: ID) => void;
  deleteObject: (id: ID) => void;
  selectObject: (id: ID | null) => void;

  addPlan: (name?: string) => void;
  setActivePlan: (id: ID) => void;
  renamePlan: (id: ID, name: string) => void;
  removePlan: (id: ID) => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: createEmptyProject(),
  selectedObjectId: null,

  activePlan: () => {
    const { project } = get();
    return project.plans.find((p) => p.id === project.activePlanId) ?? project.plans[0];
  },

  setProject: (project) => set({ project, selectedObjectId: null }),
  resetProject: () => set({ project: createEmptyProject(), selectedObjectId: null }),
  setProjectName: (name) =>
    set((s) => ({ project: { ...s.project, name, updatedAt: new Date().toISOString() } })),

  setRoomSize: (width, height) =>
    set((s) => ({
      project: {
        ...s.project,
        plans: s.project.plans.map((p) =>
          p.id === s.project.activePlanId ? { ...p, room: { width, height } } : p,
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  setSettings: (patch) =>
    set((s) => ({ project: { ...s.project, settings: { ...s.project.settings, ...patch } } })),

  addObjectFromKind: (kind, x, y) => {
    const item = libraryItemByKind(kind);
    if (!item) return;
    set((s) => {
      const plan = s.project.plans.find((p) => p.id === s.project.activePlanId);
      if (!plan) return s;
      const startX = x ?? plan.room.width / 2 - item.defaultWidth / 2;
      const startY = y ?? plan.room.height / 2 - item.defaultHeight / 2;
      const grid = s.project.settings.snapToGrid ? s.project.settings.gridSize : 0;
      const snapped = {
        x: snapToGrid(startX, grid),
        y: snapToGrid(startY, grid),
      };
      const clamped = clampToRoom(
        snapped.x,
        snapped.y,
        item.defaultWidth,
        item.defaultHeight,
        plan.room.width,
        plan.room.height,
      );
      const obj: LayoutObject = {
        id: genId("obj"),
        kind: item.kind,
        label: item.label,
        x: clamped.x,
        y: clamped.y,
        width: item.defaultWidth,
        height: item.defaultHeight,
        rotation: 0,
        seats: item.seats,
        chairClearance: item.chairClearance,
        frontClearance: item.frontClearance,
      };
      return {
        project: {
          ...s.project,
          plans: s.project.plans.map((p) =>
            p.id === plan.id ? { ...p, objects: [...p.objects, obj] } : p,
          ),
          updatedAt: new Date().toISOString(),
        },
        selectedObjectId: obj.id,
      };
    });
  },

  updateObject: (id, patch) =>
    set((s) => ({
      project: {
        ...s.project,
        plans: s.project.plans.map((p) =>
          p.id === s.project.activePlanId
            ? { ...p, objects: p.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)) }
            : p,
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  moveObject: (id, x, y) => {
    const s = get();
    const plan = s.project.plans.find((p) => p.id === s.project.activePlanId);
    if (!plan) return;
    const obj = plan.objects.find((o) => o.id === id);
    if (!obj) return;
    const grid = s.project.settings.snapToGrid ? s.project.settings.gridSize : 0;
    const sx = snapToGrid(x, grid);
    const sy = snapToGrid(y, grid);
    const isSwapped = obj.rotation === 90 || obj.rotation === 270;
    const w = isSwapped ? obj.height : obj.width;
    const h = isSwapped ? obj.width : obj.height;
    const c = clampToRoom(sx, sy, w, h, plan.room.width, plan.room.height);
    s.updateObject(id, { x: c.x, y: c.y });
  },

  rotateObject: (id) => {
    const s = get();
    const plan = s.activePlan();
    const obj = plan.objects.find((o) => o.id === id);
    if (!obj) return;
    const next: Record<number, 0 | 90 | 180 | 270> = { 0: 90, 90: 180, 180: 270, 270: 0 };
    s.updateObject(id, { rotation: next[obj.rotation] });
  },

  deleteObject: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        plans: s.project.plans.map((p) =>
          p.id === s.project.activePlanId
            ? { ...p, objects: p.objects.filter((o) => o.id !== id) }
            : p,
        ),
        updatedAt: new Date().toISOString(),
      },
      selectedObjectId: s.selectedObjectId === id ? null : s.selectedObjectId,
    })),

  selectObject: (id) => set({ selectedObjectId: id }),

  addPlan: (name) =>
    set((s) => {
      const room = s.activePlan().room;
      const plan = createEmptyPlan(name ?? `案${s.project.plans.length + 1}`, { ...room });
      return {
        project: {
          ...s.project,
          plans: [...s.project.plans, plan],
          activePlanId: plan.id,
          updatedAt: new Date().toISOString(),
        },
        selectedObjectId: null,
      };
    }),

  setActivePlan: (id) =>
    set((s) => ({
      project: { ...s.project, activePlanId: id },
      selectedObjectId: null,
    })),

  renamePlan: (id, name) =>
    set((s) => ({
      project: {
        ...s.project,
        plans: s.project.plans.map((p) => (p.id === id ? { ...p, name } : p)),
      },
    })),

  removePlan: (id) =>
    set((s) => {
      if (s.project.plans.length <= 1) return s; // 最低1案は残す
      const remaining = s.project.plans.filter((p) => p.id !== id);
      const activeId =
        s.project.activePlanId === id ? remaining[0].id : s.project.activePlanId;
      return {
        project: { ...s.project, plans: remaining, activePlanId: activeId },
        selectedObjectId: null,
      };
    }),
}));
