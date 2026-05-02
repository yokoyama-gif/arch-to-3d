import type { Shift, ShiftInput, ShiftFilter } from './types/shift';

declare global {
  interface UberApi {
    listShifts: (filter?: ShiftFilter) => Promise<Shift[]>;
    insertShift: (input: ShiftInput) => Promise<Shift>;
    updateShift: (id: number, input: ShiftInput) => Promise<Shift>;
    deleteShift: (id: number) => Promise<{ ok: true }>;
    bulkInsertShifts: (rows: ShiftInput[]) => Promise<number>;
    saveText: (payload: {
      defaultPath: string;
      content: string;
      filters?: { name: string; extensions: string[] }[];
    }) => Promise<{ canceled: boolean; filePath?: string }>;
    openText: (payload?: {
      filters?: { name: string; extensions: string[] }[];
    }) => Promise<{ canceled: boolean; filePath?: string; content?: string }>;
  }

  interface Window {
    uberApi: UberApi;
  }
}

export {};
