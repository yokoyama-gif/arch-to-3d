import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, ElectronAPI, StartConversionPayload, AppSettings } from '../shared/types';

const electronAPI: ElectronAPI = {
  selectFiles: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_FILES),

  selectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_FOLDER),

  selectOutputFolder: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_OUTPUT_FOLDER),

  startConversion: (payload: StartConversionPayload) =>
    ipcRenderer.invoke(IPC_CHANNELS.START_CONVERSION, payload),

  cancelConversion: (jobId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CANCEL_CONVERSION, jobId),

  cancelAll: () => ipcRenderer.invoke(IPC_CHANNELS.CANCEL_ALL),

  openFolder: (folderPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_FOLDER, folderPath),

  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),

  saveSettings: (settings: AppSettings) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),

  onJobProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) =>
      callback(data as Parameters<typeof callback>[0]);
    ipcRenderer.on(IPC_CHANNELS.JOB_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.JOB_PROGRESS, handler);
  },

  onJobCompleted: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) =>
      callback(data as Parameters<typeof callback>[0]);
    ipcRenderer.on(IPC_CHANNELS.JOB_COMPLETED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.JOB_COMPLETED, handler);
  },

  onJobFailed: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) =>
      callback(data as Parameters<typeof callback>[0]);
    ipcRenderer.on(IPC_CHANNELS.JOB_FAILED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.JOB_FAILED, handler);
  },

  onLogMessage: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) =>
      callback(data as Parameters<typeof callback>[0]);
    ipcRenderer.on(IPC_CHANNELS.LOG_MESSAGE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.LOG_MESSAGE, handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
