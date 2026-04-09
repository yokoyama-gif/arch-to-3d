import { create } from 'zustand';
import { autoArrangeObjects } from '../logic/autoLayout/autoArrange';
import { evaluatePlan } from '../logic/evaluation/evaluatePlan';
import { normalizeRotation } from '../logic/geometry/rect';
import { applySnapping, snapExistingObjectToRoom } from '../logic/snapping/snapObject';
import { createDemoProject } from '../models/demoProject';
import { createDoor, createId, createLibraryObject, createPlanFromTemplate, createZone } from '../models/factories';
import { libraryItems } from '../models/presets';
import { layoutTemplates } from '../models/templates';
import type {
  EvaluationResult,
  LayoutObject,
  LayoutPlan,
  OverlayKind,
  OverlayVisibility,
  Project,
  ProjectSettings,
  Rotation,
  RoomDoor,
  WallSide,
  Zone,
  ZoneType,
} from '../models/types';

const CUSTOM_LIBRARY_KEY = 'office-layouter.custom-library';

const defaultSettings: ProjectSettings = {
  unit: 'mm',
  gridSize: 100,
  snapToGrid: true,
  minCorridorWidth: 900,
  chairClearance: 800,
  wallSnapThreshold: 120,
  doorClearance: 1200,
  meetingEntryClearance: 1100,
  receptionServiceDistance: 4500,
  commonAreaClearance: 1000,
  autoLayoutGap: 400,
};

const emptyEvaluation: EvaluationResult = {
  issues: [],
  metrics: {
    totalSeats: 0,
    meetingSeats: 0,
    occupiedAreaRatio: 0,
    minCorridorWidth: 0,
    warningCount: 0,
    ngCount: 0,
    score: 100,
    zoneCount: 0,
    sharedAreaRatio: 0,
    pressureIndex: 0,
  },
};

const defaultOverlayVisibility: OverlayVisibility = {
  corridor: true,
  chair: false,
  door: true,
  reception: true,
  copy: true,
  meeting: true,
};

const isDemoMode = () =>
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('demo') === '1';

const readCustomLibrary = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [] as Project['customLibrary'];
  }
  try {
    const raw = window.localStorage.getItem(CUSTOM_LIBRARY_KEY);
    return raw ? (JSON.parse(raw) as Project['customLibrary']) : [];
  } catch {
    return [];
  }
};

const persistCustomLibrary = (items: Project['customLibrary']) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(CUSTOM_LIBRARY_KEY, JSON.stringify(items));
};

const createPlan = (name: string): LayoutPlan => ({
  id: createId('plan'),
  name,
  room: {
    id: createId('room'),
    name: 'オフィス空間',
    width: 12000,
    height: 8000,
    wallThickness: 180,
    doors: [createDoor('bottom')],
  },
  zones: [],
  objects: [],
  evaluation: emptyEvaluation,
});

const normalizePlan = (
  plan: LayoutPlan,
  settings: ProjectSettings,
): LayoutPlan => {
  const normalizedPlan: LayoutPlan = {
    ...plan,
    room: {
      ...plan.room,
      wallThickness: plan.room.wallThickness ?? 180,
      doors: (plan.room.doors ?? []).map((door) => ({
        ...door,
        swing: door.swing ?? 'inward',
      })),
    },
    zones: plan.zones ?? [],
    objects: (plan.objects ?? []).map((object) =>
      snapExistingObjectToRoom(object, plan.room, settings),
    ),
    evaluation: emptyEvaluation,
  };

  return {
    ...normalizedPlan,
    evaluation: evaluatePlan(normalizedPlan, settings),
  };
};

const normalizeProject = (project: Project): Project => {
  const settings = { ...defaultSettings, ...(project.settings ?? {}) };
  const customLibrary = project.customLibrary ?? readCustomLibrary();
  const plans =
    project.plans?.map((plan) => normalizePlan(plan, settings)) ?? [createPlan('案 1')];
  return {
    ...project,
    settings,
    customLibrary,
    plans,
  };
};

export const createInitialProject = (): Project => {
  const project: Project = {
    id: createId('project'),
    name: 'オフィスレイアウター MVP',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: defaultSettings,
    customLibrary: readCustomLibrary(),
    plans: [createPlan('案 1')],
  };

  return normalizeProject(project);
};

type StoreState = {
  project: Project;
  activePlanId: string;
  selectedObjectId: string | null;
  showComparison: boolean;
  overlayVisibility: OverlayVisibility;
  lastSavedPath: string | null;
};

type StoreActions = {
  addObject: (libraryItemId: string) => void;
  updateObjectPosition: (objectId: string, x: number, y: number) => void;
  updateObjectRotation: (objectId: string, rotation: Rotation) => void;
  updateObjectFields: (
    objectId: string,
    updates: Partial<Pick<LayoutObject, 'x' | 'y' | 'width' | 'height' | 'name' | 'seatCount'>>,
  ) => void;
  deleteSelectedObject: () => void;
  selectObject: (objectId: string | null) => void;
  rotateSelectedObject: () => void;
  updateRoom: (updates: Partial<LayoutPlan['room']>) => void;
  addDoor: (wall?: WallSide) => void;
  updateDoor: (doorId: string, updates: Partial<RoomDoor>) => void;
  deleteDoor: (doorId: string) => void;
  addZone: (type?: ZoneType) => void;
  updateZone: (zoneId: string, updates: Partial<Zone>) => void;
  deleteZone: (zoneId: string) => void;
  toggleSnap: () => void;
  updateSettings: (updates: Partial<ProjectSettings>) => void;
  addPlan: () => void;
  switchPlan: (planId: string) => void;
  duplicatePlan: () => void;
  toggleComparison: () => void;
  toggleOverlay: (kind: OverlayKind) => void;
  applyTemplate: (templateId: string) => void;
  autoArrangeCurrentPlan: () => void;
  saveSelectedAsCustomLibraryItem: () => void;
  deleteCustomLibraryItem: (itemId: string) => void;
  replaceProject: (project: Project) => void;
  saveProjectToFile: () => Promise<void>;
  loadProjectFromFile: () => Promise<void>;
};

type ProjectStore = StoreState & StoreActions;

const recalculateProject = (project: Project): Project => {
  const normalized = normalizeProject(project);
  return {
    ...normalized,
    updatedAt: new Date().toISOString(),
    plans: normalized.plans.map((plan) => normalizePlan(plan, normalized.settings)),
  };
};

const updateActivePlan = (
  project: Project,
  activePlanId: string,
  updater: (plan: LayoutPlan) => LayoutPlan,
) => ({
  ...project,
  plans: project.plans.map((plan) => (plan.id === activePlanId ? updater(plan) : plan)),
});

const getLibrarySource = (project: Project) => [...libraryItems, ...project.customLibrary];

export const useProjectStore = create<ProjectStore>((set, get) => {
  const initialProject = isDemoMode()
    ? normalizeProject(createDemoProject(defaultSettings))
    : createInitialProject();
  const initialActivePlan =
    initialProject.plans.find((plan) => plan.name === '来客対応重視') ?? initialProject.plans[0];
  const initialSelectedObject =
    initialActivePlan?.objects.find((object) => object.libraryItemId === 'reception-counter') ??
    initialActivePlan?.objects[0] ??
    null;

  return {
    project: initialProject,
    activePlanId: initialActivePlan?.id ?? initialProject.plans[0]!.id,
    selectedObjectId: isDemoMode() ? initialSelectedObject?.id ?? null : null,
    showComparison: isDemoMode(),
    overlayVisibility: defaultOverlayVisibility,
    lastSavedPath: null,
    addObject: (libraryItemId) => {
      set((state) => {
        const item = getLibrarySource(state.project).find(
          (candidate) => candidate.id === libraryItemId,
        );
        const plan = state.project.plans.find((candidate) => candidate.id === state.activePlanId);
        if (!item || !plan) {
          return state;
        }

        const x = 1000 + plan.objects.length * 220;
        const y = 1000 + plan.objects.length * 160;
        const object = createLibraryObject(item, x, y);
        const project = recalculateProject(
          updateActivePlan(state.project, state.activePlanId, (currentPlan) => ({
            ...currentPlan,
            objects: [...currentPlan.objects, object],
          })),
        );
        return { ...state, project, selectedObjectId: object.id };
      });
    },
    updateObjectPosition: (objectId, x, y) => {
      set((state) => {
        const plan = state.project.plans.find((candidate) => candidate.id === state.activePlanId);
        const object = plan?.objects.find((candidate) => candidate.id === objectId);
        if (!plan || !object) {
          return state;
        }

        const snapped = applySnapping(object, plan.room, state.project.settings, x, y);
        const project = recalculateProject(
          updateActivePlan(state.project, state.activePlanId, (currentPlan) => ({
            ...currentPlan,
            objects: currentPlan.objects.map((candidate) =>
              candidate.id === objectId
                ? { ...candidate, x: snapped.x, y: snapped.y }
                : candidate,
            ),
          })),
        );

        return { ...state, project };
      });
    },
    updateObjectRotation: (objectId, rotation) => {
      set((state) => {
        const project = recalculateProject(
          updateActivePlan(state.project, state.activePlanId, (currentPlan) => ({
            ...currentPlan,
            objects: currentPlan.objects.map((candidate) =>
              candidate.id === objectId
                ? { ...candidate, rotation: normalizeRotation(rotation) }
                : candidate,
            ),
          })),
        );

        return { ...state, project };
      });
    },
    updateObjectFields: (objectId, updates) => {
      set((state) => ({
        ...state,
        project: recalculateProject(
          updateActivePlan(state.project, state.activePlanId, (currentPlan) => ({
            ...currentPlan,
            objects: currentPlan.objects.map((candidate) =>
              candidate.id === objectId ? { ...candidate, ...updates } : candidate,
            ),
          })),
        ),
      }));
    },
    deleteSelectedObject: () => {
      set((state) => {
        if (!state.selectedObjectId) {
          return state;
        }
        const project = recalculateProject(
          updateActivePlan(state.project, state.activePlanId, (currentPlan) => ({
            ...currentPlan,
            objects: currentPlan.objects.filter(
              (candidate) => candidate.id !== state.selectedObjectId,
            ),
          })),
        );
        return { ...state, project, selectedObjectId: null };
      });
    },
    selectObject: (objectId) => set((state) => ({ ...state, selectedObjectId: objectId })),
    rotateSelectedObject: () => {
      const state = get();
      const plan = state.project.plans.find((candidate) => candidate.id === state.activePlanId);
      const object = plan?.objects.find((candidate) => candidate.id === state.selectedObjectId);
      if (!object) {
        return;
      }
      get().updateObjectRotation(object.id, normalizeRotation(object.rotation + 90));
    },
    updateRoom: (updates) => {
      set((state) => ({
        ...state,
        project: recalculateProject(
          updateActivePlan(state.project, state.activePlanId, (currentPlan) => ({
            ...currentPlan,
            room: {
              ...currentPlan.room,
              ...updates,
            },
          })),
        ),
      }));
    },
    addDoor: (wall = 'bottom') => {
      set((state) => ({
        ...state,
        project: recalculateProject(
          updateActivePlan(state.project, state.activePlanId, (currentPlan) => ({
            ...currentPlan,
            room: {
              ...currentPlan.room,
              doors: [...currentPlan.room.doors, createDoor(wall)],
            },
          })),
        ),
      }));
    },
    updateDoor: (doorId, updates) => {
      set((state) => ({
        ...state,
        project: recalculateProject(
          updateActivePlan(state.project, state.activePlanId, (currentPlan) => ({
            ...currentPlan,
            room: {
              ...currentPlan.room,
              doors: currentPlan.room.doors.map((door) =>
                door.id === doorId ? { ...door, ...updates } : door,
              ),
            },
          })),
        ),
      }));
    },
    deleteDoor: (doorId) => {
      set((state) => ({
        ...state,
        project: recalculateProject(
          updateActivePlan(state.project, state.activePlanId, (currentPlan) => ({
            ...currentPlan,
            room: {
              ...currentPlan.room,
              doors: currentPlan.room.doors.filter((door) => door.id !== doorId),
            },
          })),
        ),
      }));
    },
    addZone: (type = 'work') => {
      set((state) => ({
        ...state,
        project: recalculateProject(
          updateActivePlan(state.project, state.activePlanId, (currentPlan) => ({
            ...currentPlan,
            zones: [...currentPlan.zones, createZone(type)],
          })),
        ),
      }));
    },
    updateZone: (zoneId, updates) => {
      set((state) => ({
        ...state,
        project: recalculateProject(
          updateActivePlan(state.project, state.activePlanId, (currentPlan) => ({
            ...currentPlan,
            zones: currentPlan.zones.map((zone) =>
              zone.id === zoneId
                ? {
                    ...zone,
                    ...updates,
                    rect: {
                      ...zone.rect,
                      ...(updates.rect ?? {}),
                    },
                  }
                : zone,
            ),
          })),
        ),
      }));
    },
    deleteZone: (zoneId) => {
      set((state) => ({
        ...state,
        project: recalculateProject(
          updateActivePlan(state.project, state.activePlanId, (currentPlan) => ({
            ...currentPlan,
            zones: currentPlan.zones.filter((zone) => zone.id !== zoneId),
          })),
        ),
      }));
    },
    toggleSnap: () =>
      set((state) => ({
        ...state,
        project: recalculateProject({
          ...state.project,
          settings: {
            ...state.project.settings,
            snapToGrid: !state.project.settings.snapToGrid,
          },
        }),
      })),
    updateSettings: (updates) =>
      set((state) => ({
        ...state,
        project: recalculateProject({
          ...state.project,
          settings: { ...state.project.settings, ...updates },
        }),
      })),
    addPlan: () =>
      set((state) => {
        const plan = createPlan(`案 ${state.project.plans.length + 1}`);
        const project = recalculateProject({
          ...state.project,
          plans: [...state.project.plans, plan],
        });
        return { ...state, project, activePlanId: plan.id, selectedObjectId: null };
      }),
    switchPlan: (planId) =>
      set((state) => ({ ...state, activePlanId: planId, selectedObjectId: null })),
    duplicatePlan: () =>
      set((state) => {
        const plan = state.project.plans.find((candidate) => candidate.id === state.activePlanId);
        if (!plan) {
          return state;
        }
        const duplicated: LayoutPlan = {
          ...structuredClone(plan),
          id: createId('plan'),
          room: { ...structuredClone(plan.room), id: createId('room') },
          name: `${plan.name} 複製`,
        };
        const project = recalculateProject({
          ...state.project,
          plans: [...state.project.plans, duplicated],
        });
        return { ...state, project, activePlanId: duplicated.id, selectedObjectId: null };
      }),
    toggleComparison: () =>
      set((state) => ({ ...state, showComparison: !state.showComparison })),
    toggleOverlay: (kind) =>
      set((state) => ({
        ...state,
        overlayVisibility: {
          ...state.overlayVisibility,
          [kind]: !state.overlayVisibility[kind],
        },
      })),
    applyTemplate: (templateId) => {
      const state = get();
      const template = layoutTemplates.find((candidate) => candidate.id === templateId);
      if (!template) {
        return;
      }
      const templated = createPlanFromTemplate(template, state.project.settings);
      set((current) => ({
        ...current,
        project: recalculateProject(
          updateActivePlan(current.project, current.activePlanId, (currentPlan) => ({
            ...templated,
            id: currentPlan.id,
            name: templated.name,
          })),
        ),
        selectedObjectId: null,
      }));
    },
    autoArrangeCurrentPlan: () => {
      set((state) => ({
        ...state,
        project: recalculateProject(
          updateActivePlan(state.project, state.activePlanId, (currentPlan) => ({
            ...currentPlan,
            objects: autoArrangeObjects(currentPlan, state.project.settings.autoLayoutGap).map(
              (object) => snapExistingObjectToRoom(object, currentPlan.room, state.project.settings),
            ),
          })),
        ),
      }));
    },
    saveSelectedAsCustomLibraryItem: () => {
      const state = get();
      const plan = state.project.plans.find((candidate) => candidate.id === state.activePlanId);
      const object = plan?.objects.find((candidate) => candidate.id === state.selectedObjectId);
      if (!object) {
        return;
      }

      const customItem = {
        id: createId('custom-item'),
        type: object.type,
        name: `${object.name} カスタム`,
        category: object.category,
        width: object.width,
        height: object.height,
        seatCount: object.seatCount,
        fill: object.fill,
        stroke: object.stroke,
        origin: 'custom' as const,
        metadata: structuredClone(object.metadata),
      };

      const customLibrary = [...state.project.customLibrary, customItem];
      persistCustomLibrary(customLibrary);
      set((current) => ({
        ...current,
        project: recalculateProject({
          ...current.project,
          customLibrary,
        }),
      }));
    },
    deleteCustomLibraryItem: (itemId) => {
      set((state) => {
        const customLibrary = state.project.customLibrary.filter((item) => item.id !== itemId);
        persistCustomLibrary(customLibrary);
        return {
          ...state,
          project: recalculateProject({
            ...state.project,
            customLibrary,
          }),
        };
      });
    },
    replaceProject: (project) => {
      const normalized = normalizeProject(project);
      persistCustomLibrary(normalized.customLibrary);
      set(() => ({
        project: recalculateProject(normalized),
        activePlanId: normalized.plans[0]?.id ?? createPlan('案 1').id,
        selectedObjectId: null,
        showComparison: false,
        lastSavedPath: null,
      }));
    },
    saveProjectToFile: async () => {
      const api = window.officeApi;
      if (!api) {
        return;
      }
      const state = get();
      const result = await api.saveProject(JSON.stringify(state.project, null, 2));
      if (!result.canceled) {
        set((current) => ({ ...current, lastSavedPath: result.filePath ?? null }));
      }
    },
    loadProjectFromFile: async () => {
      const api = window.officeApi;
      if (!api) {
        return;
      }

      const result = await api.loadProject();
      if (result.canceled || !result.content) {
        return;
      }

      const project = normalizeProject(JSON.parse(result.content) as Project);
      persistCustomLibrary(project.customLibrary);
      set(() => ({
        project: recalculateProject(project),
        activePlanId: project.plans[0]?.id ?? createPlan('案 1').id,
        selectedObjectId: null,
        showComparison: false,
        lastSavedPath: result.filePath ?? null,
      }));
    },
  };
});

export const useActivePlan = () =>
  useProjectStore((state) =>
    state.project.plans.find((plan) => plan.id === state.activePlanId) ?? state.project.plans[0],
  );
