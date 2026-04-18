"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('officeApi', {
    saveProject: (payload) => electron_1.ipcRenderer.invoke('project:save', payload),
    loadProject: () => electron_1.ipcRenderer.invoke('project:load'),
    saveTextFile: (payload) => electron_1.ipcRenderer.invoke('file:saveText', payload),
    saveBinaryFile: (payload) => electron_1.ipcRenderer.invoke('file:saveBinary', payload),
    exportPdf: (payload) => electron_1.ipcRenderer.invoke('export:pdf', payload),
});
