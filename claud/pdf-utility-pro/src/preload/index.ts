import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface FileData {
  path: string
  name: string
  data: ArrayBuffer
}

const api = {
  openFiles: (): Promise<FileData[]> => ipcRenderer.invoke('dialog:openFiles'),

  readFiles: (filePaths: string[]): Promise<FileData[]> =>
    ipcRenderer.invoke('file:readFiles', filePaths),

  saveFile: (defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveFile', defaultName),

  writeFile: (filePath: string, data: ArrayBuffer): Promise<void> =>
    ipcRenderer.invoke('file:write', filePath, data)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (e) {
    console.error(e)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.electronAPI = api
}
