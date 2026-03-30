import { contextBridge, ipcRenderer } from 'electron'
import type { ProcessingResult, ProgressUpdate, ExportOptions, ElectronAPI } from '../shared/types'

const electronAPI: ElectronAPI = {
  processFile: (filePath: string): Promise<ProcessingResult> => {
    return ipcRenderer.invoke('process-file', filePath)
  },

  onProgress: (callback: (update: ProgressUpdate) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, update: ProgressUpdate) => {
      callback(update)
    }
    ipcRenderer.on('processing-progress', handler)
    return () => {
      ipcRenderer.removeListener('processing-progress', handler)
    }
  },

  selectFile: (): Promise<string | null> => {
    return ipcRenderer.invoke('select-file')
  },

  exportResult: (result: ProcessingResult, options: ExportOptions): Promise<string | null> => {
    return ipcRenderer.invoke('export-result', result, options)
  },

  cancelProcessing: () => {
    ipcRenderer.send('cancel-processing')
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
