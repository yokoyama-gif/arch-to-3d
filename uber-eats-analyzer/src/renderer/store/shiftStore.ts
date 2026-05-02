import { create } from 'zustand';
import type { Shift, ShiftInput } from '../types/shift';

type State = {
  shifts: Shift[];
  loading: boolean;
  error: string | null;
  toast: string | null;
  refresh: () => Promise<void>;
  add: (input: ShiftInput) => Promise<Shift>;
  update: (id: number, input: ShiftInput) => Promise<Shift>;
  remove: (id: number) => Promise<void>;
  bulkAdd: (rows: ShiftInput[]) => Promise<number>;
  showToast: (msg: string) => void;
  clearToast: () => void;
};

export const useShiftStore = create<State>((set, get) => ({
  shifts: [],
  loading: false,
  error: null,
  toast: null,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const shifts = await window.uberApi.listShifts();
      set({ shifts, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },
  add: async (input) => {
    const created = await window.uberApi.insertShift(input);
    await get().refresh();
    return created;
  },
  update: async (id, input) => {
    const updated = await window.uberApi.updateShift(id, input);
    await get().refresh();
    return updated;
  },
  remove: async (id) => {
    await window.uberApi.deleteShift(id);
    await get().refresh();
  },
  bulkAdd: async (rows) => {
    const n = await window.uberApi.bulkInsertShifts(rows);
    await get().refresh();
    return n;
  },
  showToast: (msg) => {
    set({ toast: msg });
    setTimeout(() => {
      if (get().toast === msg) set({ toast: null });
    }, 4000);
  },
  clearToast: () => set({ toast: null }),
}));
