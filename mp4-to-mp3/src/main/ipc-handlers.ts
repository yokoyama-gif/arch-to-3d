import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import path from 'path';
import { IPC_CHANNELS, AppSettings, StartConversionPayload } from '../shared/types';
import { SettingsManager } from './services/settings-manager';
import { QueueManager } from './services/queue-manager';

const settingsManager = new SettingsManager();
let queueManager: QueueManager | null = null;

function getWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows();
  return windows.length > 0 ? windows[0] : null;
}

export function registerIpcHandlers(): void {
  // ファイル選択
  ipcMain.handle(IPC_CHANNELS.SELECT_FILES, async () => {
    const win = getWindow();
    if (!win) return [];
    const result = await dialog.showOpenDialog(win, {
      title: 'MP4ファイルを選択',
      filters: [{ name: 'MP4動画', extensions: ['mp4', 'MP4'] }],
      properties: ['openFile', 'multiSelections'],
    });
    return result.canceled ? [] : result.filePaths;
  });

  // フォルダ選択（中のMP4を返す）
  ipcMain.handle(IPC_CHANNELS.SELECT_FOLDER, async () => {
    const win = getWindow();
    if (!win) return [];
    const result = await dialog.showOpenDialog(win, {
      title: 'フォルダを選択（中のMP4を読み込み）',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return [];

    const fs = await import('fs');
    const folderPath = result.filePaths[0];
    const files = fs.readdirSync(folderPath);
    return files
      .filter((f: string) => /\.mp4$/i.test(f))
      .map((f: string) => path.join(folderPath, f));
  });

  // 出力先フォルダ選択
  ipcMain.handle(IPC_CHANNELS.SELECT_OUTPUT_FOLDER, async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: '出力先フォルダを選択',
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  // 変換開始
  ipcMain.handle(IPC_CHANNELS.START_CONVERSION, async (_event, payload: StartConversionPayload) => {
    const win = getWindow();
    if (!win) return;

    queueManager = new QueueManager(win, payload.options);
    await queueManager.start(payload.jobs);
  });

  // 変換キャンセル（単体）
  ipcMain.handle(IPC_CHANNELS.CANCEL_CONVERSION, async (_event, jobId: string) => {
    queueManager?.cancelJob(jobId);
  });

  // 全キャンセル
  ipcMain.handle(IPC_CHANNELS.CANCEL_ALL, async () => {
    queueManager?.cancelAll();
  });

  // フォルダを開く
  ipcMain.handle(IPC_CHANNELS.OPEN_FOLDER, async (_event, folderPath: string) => {
    await shell.openPath(folderPath);
  });

  // 設定取得
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
    return settingsManager.load();
  });

  // 設定保存
  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, async (_event, settings: AppSettings) => {
    settingsManager.save(settings);
  });
}
