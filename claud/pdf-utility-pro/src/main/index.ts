import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { readFile, writeFile } from 'fs/promises'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'PDF Utility Pro',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pdfutilitypro')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // PDFファイルを選択してデータを返す
  ipcMain.handle('dialog:openFiles', async () => {
    const result = await dialog.showOpenDialog({
      title: 'PDFファイルを選択',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled || result.filePaths.length === 0) return []

    const files = await Promise.all(
      result.filePaths.map(async (filePath) => {
        const buf = await readFile(filePath)
        return {
          path: filePath,
          name: filePath.split(/[\\/]/).pop() ?? filePath,
          data: buf.buffer as ArrayBuffer
        }
      })
    )
    return files
  })

  // ドラッグ＆ドロップで渡されたパスからファイルを読む
  ipcMain.handle('file:readFiles', async (_event, filePaths: string[]) => {
    const files = await Promise.all(
      filePaths.map(async (filePath) => {
        const buf = await readFile(filePath)
        return {
          path: filePath,
          name: filePath.split(/[\\/]/).pop() ?? filePath,
          data: buf.buffer as ArrayBuffer
        }
      })
    )
    return files
  })

  // 保存先ダイアログ
  ipcMain.handle('dialog:saveFile', async (_event, defaultName: string) => {
    const result = await dialog.showSaveDialog({
      title: '保存先を選択',
      defaultPath: defaultName,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    })
    if (result.canceled) return null
    return result.filePath ?? null
  })

  // ファイル書き込み（上書き確認は保存ダイアログが担う）
  ipcMain.handle('file:write', async (_event, filePath: string, data: ArrayBuffer) => {
    await writeFile(filePath, Buffer.from(data))
  })

  // 保存先フォルダ選択（PDF→画像の一括出力用）
  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      title: '出力フォルダを選択',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // 指定パスへバイナリ書き込み（フォルダ配下のファイル作成用）
  ipcMain.handle('file:writeToPath', async (_event, filePath: string, data: ArrayBuffer) => {
    await writeFile(filePath, Buffer.from(data))
  })

  // 画像ファイルを開いて読む（image → PDF 変換用）
  ipcMain.handle('dialog:openImages', async () => {
    const result = await dialog.showOpenDialog({
      title: '画像ファイルを選択',
      filters: [{ name: '画像ファイル', extensions: ['png', 'jpg', 'jpeg'] }],
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled || result.filePaths.length === 0) return []

    const files = await Promise.all(
      result.filePaths.map(async (filePath) => {
        const buf = await readFile(filePath)
        const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
        return {
          path: filePath,
          name: filePath.split(/[\\/]/).pop() ?? filePath,
          data: buf.buffer as ArrayBuffer,
          type: ext === 'png' ? 'image/png' : 'image/jpeg'
        }
      })
    )
    return files
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
