import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('officeApi', {
  saveProject: (payload: string) => ipcRenderer.invoke('project:save', payload),
  loadProject: () => ipcRenderer.invoke('project:load'),
  saveTextFile: (payload: {
    defaultPath: string;
    content: string;
    filters?: { name: string; extensions: string[] }[];
  }) => ipcRenderer.invoke('file:saveText', payload),
  saveBinaryFile: (payload: {
    defaultPath: string;
    bytes: number[];
    filters?: { name: string; extensions: string[] }[];
  }) => ipcRenderer.invoke('file:saveBinary', payload),
  exportPdf: (payload: { defaultPath: string; html: string }) =>
    ipcRenderer.invoke('export:pdf', payload),
});
