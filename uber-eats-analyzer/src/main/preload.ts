import { contextBridge, ipcRenderer } from 'electron';

export type ShiftInput = {
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  earnings: number;
  delivery_count: number;
  distance_km: number;
  area: string | null;
  weather: string | null;
  memo: string | null;
  source?: string;
};

export type ShiftFilter = {
  from?: string;
  to?: string;
  area?: string;
  weather?: string;
};

const api = {
  listShifts: (filter?: ShiftFilter) => ipcRenderer.invoke('shifts:list', filter),
  insertShift: (input: ShiftInput) => ipcRenderer.invoke('shifts:insert', input),
  updateShift: (id: number, input: ShiftInput) =>
    ipcRenderer.invoke('shifts:update', { id, input }),
  deleteShift: (id: number) => ipcRenderer.invoke('shifts:delete', id),
  bulkInsertShifts: (rows: ShiftInput[]) => ipcRenderer.invoke('shifts:bulkInsert', rows),
  saveText: (payload: {
    defaultPath: string;
    content: string;
    filters?: { name: string; extensions: string[] }[];
  }) => ipcRenderer.invoke('file:saveText', payload),
  openText: (payload?: { filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('file:openText', payload),
};

contextBridge.exposeInMainWorld('uberApi', api);

export type UberApi = typeof api;
