import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const isDev = !app.isPackaged;

const createWindow = async () => {
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#edf2f7',
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

app.whenReady().then(() => {
  ipcMain.handle('project:save', async (_event, payload: string) => {
    const result = await dialog.showSaveDialog({
      title: 'レイアウト案を保存',
      defaultPath: 'office-layout-project.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    await fs.writeFile(result.filePath, payload, 'utf8');
    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.handle('project:load', async () => {
    const result = await dialog.showOpenDialog({
      title: 'レイアウト案を読み込み',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf8');
    return { canceled: false, filePath, content };
  });

  ipcMain.handle(
    'file:saveText',
    async (_event, payload: { defaultPath: string; content: string; filters?: Electron.FileFilter[] }) => {
      const result = await dialog.showSaveDialog({
        title: 'テキストを書き出し',
        defaultPath: payload.defaultPath,
        filters: payload.filters,
      });

      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      await fs.writeFile(result.filePath, payload.content, 'utf8');
      return { canceled: false, filePath: result.filePath };
    },
  );

  ipcMain.handle(
    'file:saveBinary',
    async (
      _event,
      payload: { defaultPath: string; bytes: number[]; filters?: Electron.FileFilter[] },
    ) => {
      const result = await dialog.showSaveDialog({
        title: 'ファイルを書き出し',
        defaultPath: payload.defaultPath,
        filters: payload.filters,
      });

      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      await fs.writeFile(result.filePath, Uint8Array.from(payload.bytes));
      return { canceled: false, filePath: result.filePath };
    },
  );

  ipcMain.handle(
    'export:pdf',
    async (_event, payload: { defaultPath: string; html: string }) => {
      const result = await dialog.showSaveDialog({
        title: 'PDFを書き出し',
        defaultPath: payload.defaultPath,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      const pdfWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          sandbox: true,
        },
      });

      await pdfWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(payload.html)}`,
      );
      const pdf = await pdfWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
      });
      await fs.writeFile(result.filePath, pdf);
      pdfWindow.destroy();

      return { canceled: false, filePath: result.filePath };
    },
  );

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
