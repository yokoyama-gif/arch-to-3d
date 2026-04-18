"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = require("node:fs");
const isDev = !electron_1.app.isPackaged;
const createWindow = async () => {
    const window = new electron_1.BrowserWindow({
        width: 1600,
        height: 980,
        minWidth: 1200,
        minHeight: 760,
        backgroundColor: '#edf2f7',
        webPreferences: {
            preload: node_path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    if (isDev && process.env.VITE_DEV_SERVER_URL) {
        await window.loadURL(process.env.VITE_DEV_SERVER_URL);
        window.webContents.openDevTools({ mode: 'detach' });
        return;
    }
    await window.loadFile(node_path_1.default.join(electron_1.app.getAppPath(), 'dist', 'index.html'));
};
electron_1.app.whenReady().then(() => {
    electron_1.ipcMain.handle('project:save', async (_event, payload) => {
        const result = await electron_1.dialog.showSaveDialog({
            title: 'レイアウト案を保存',
            defaultPath: 'office-layout-project.json',
            filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (result.canceled || !result.filePath) {
            return { canceled: true };
        }
        await node_fs_1.promises.writeFile(result.filePath, payload, 'utf8');
        return { canceled: false, filePath: result.filePath };
    });
    electron_1.ipcMain.handle('project:load', async () => {
        const result = await electron_1.dialog.showOpenDialog({
            title: 'レイアウト案を読み込み',
            properties: ['openFile'],
            filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (result.canceled || !result.filePaths[0]) {
            return { canceled: true };
        }
        const filePath = result.filePaths[0];
        const content = await node_fs_1.promises.readFile(filePath, 'utf8');
        return { canceled: false, filePath, content };
    });
    electron_1.ipcMain.handle('file:saveText', async (_event, payload) => {
        const result = await electron_1.dialog.showSaveDialog({
            title: 'テキストを書き出し',
            defaultPath: payload.defaultPath,
            filters: payload.filters,
        });
        if (result.canceled || !result.filePath) {
            return { canceled: true };
        }
        await node_fs_1.promises.writeFile(result.filePath, payload.content, 'utf8');
        return { canceled: false, filePath: result.filePath };
    });
    electron_1.ipcMain.handle('file:saveBinary', async (_event, payload) => {
        const result = await electron_1.dialog.showSaveDialog({
            title: 'ファイルを書き出し',
            defaultPath: payload.defaultPath,
            filters: payload.filters,
        });
        if (result.canceled || !result.filePath) {
            return { canceled: true };
        }
        await node_fs_1.promises.writeFile(result.filePath, Uint8Array.from(payload.bytes));
        return { canceled: false, filePath: result.filePath };
    });
    electron_1.ipcMain.handle('export:pdf', async (_event, payload) => {
        const result = await electron_1.dialog.showSaveDialog({
            title: 'PDFを書き出し',
            defaultPath: payload.defaultPath,
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });
        if (result.canceled || !result.filePath) {
            return { canceled: true };
        }
        const pdfWindow = new electron_1.BrowserWindow({
            show: false,
            webPreferences: {
                contextIsolation: true,
                sandbox: true,
            },
        });
        await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(payload.html)}`);
        const pdf = await pdfWindow.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
        });
        await node_fs_1.promises.writeFile(result.filePath, pdf);
        pdfWindow.destroy();
        return { canceled: false, filePath: result.filePath };
    });
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
