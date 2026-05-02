const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// Windows: 日本語タイトルバー対応
app.commandLine.appendSwitch('lang', 'ja');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: '解体面積計算ツール',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // ローカルファイルアクセス許可
      webSecurity: false
    },
    show: false,
    backgroundColor: '#eef1f5'
  });

  // HTMLファイルを直接ロード
  win.loadFile('demolition-tool.html');

  // 準備完了後に表示（白画面チラつき防止）
  win.once('ready-to-show', () => {
    win.show();
  });

  // シンプルなメニュー
  const menu = Menu.buildFromTemplate([
    {
      label: 'ファイル',
      submenu: [
        {
          label: '再読み込み',
          accelerator: 'F5',
          click: () => win.reload()
        },
        { type: 'separator' },
        {
          label: '終了',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: '表示',
      submenu: [
        {
          label: 'ズームリセット',
          accelerator: 'Ctrl+0',
          click: () => win.webContents.setZoomLevel(0)
        },
        {
          label: 'ズームイン',
          accelerator: 'Ctrl+=',
          click: () => win.webContents.setZoomLevel(win.webContents.getZoomLevel() + 0.5)
        },
        {
          label: 'ズームアウト',
          accelerator: 'Ctrl+-',
          click: () => win.webContents.setZoomLevel(win.webContents.getZoomLevel() - 0.5)
        },
        { type: 'separator' },
        {
          label: '全画面表示',
          accelerator: 'F11',
          click: () => win.setFullScreen(!win.isFullScreen())
        }
      ]
    },
    {
      label: '印刷',
      click: () => win.webContents.print()
    }
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
