import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  initDb,
  listShifts,
  insertShift,
  updateShift,
  deleteShift,
  bulkInsertShifts,
  type ShiftInput,
  type ShiftFilter,
} from './db';

const isDev = !app.isPackaged;

const createWindow = async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(process.env.VITE_DEV_SERVER_URL);
    window.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  await window.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
};

app.whenReady().then(async () => {
  await initDb(app.getPath('userData'));

  ipcMain.handle('shifts:list', (_e, filter: ShiftFilter | undefined) => listShifts(filter ?? {}));
  ipcMain.handle('shifts:insert', (_e, input: ShiftInput) => insertShift(input));
  ipcMain.handle('shifts:update', (_e, payload: { id: number; input: ShiftInput }) =>
    updateShift(payload.id, payload.input),
  );
  ipcMain.handle('shifts:delete', (_e, id: number) => {
    deleteShift(id);
    return { ok: true };
  });
  ipcMain.handle('shifts:bulkInsert', (_e, rows: ShiftInput[]) => bulkInsertShifts(rows));

  ipcMain.handle(
    'file:saveText',
    async (_e, payload: { defaultPath: string; content: string; filters?: Electron.FileFilter[] }) => {
      const result = await dialog.showSaveDialog({
        title: 'ファイルを書き出し',
        defaultPath: payload.defaultPath,
        filters: payload.filters,
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      await fs.writeFile(result.filePath, payload.content, 'utf8');
      return { canceled: false, filePath: result.filePath };
    },
  );

  ipcMain.handle(
    'file:openText',
    async (_e, payload: { filters?: Electron.FileFilter[] } | undefined) => {
      const result = await dialog.showOpenDialog({
        title: 'ファイルを読み込み',
        properties: ['openFile'],
        filters: payload?.filters,
      });
      if (result.canceled || !result.filePaths[0]) return { canceled: true };
      const content = await fs.readFile(result.filePaths[0], 'utf8');
      return { canceled: false, filePath: result.filePaths[0], content };
    },
  );

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
