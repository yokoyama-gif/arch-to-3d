import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { extractAudio, convertToWav, isVideoFile, cleanupTempFile } from './services/ffmpeg'
import { loadModel, transcribe, disposeModel } from './services/transcriber'
import { processText } from './services/text-processor'
import {
  SUPPORTED_EXTENSIONS,
  ProcessingResult,
  ProgressUpdate,
  ExportOptions,
  ExportFormat
} from '../shared/types'

let isProcessing = false
let shouldCancel = false

function sendProgress(win: BrowserWindow | null, update: ProgressUpdate) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('processing-progress', update)
  }
}

export function setupIpcHandlers() {
  // ファイル選択ダイアログ
  ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'ファイルを選択',
      filters: [
        {
          name: '動画・音声ファイル',
          extensions: SUPPORTED_EXTENSIONS.map(ext => ext.slice(1))
        }
      ],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // メイン処理
  ipcMain.handle('process-file', async (event, filePath: string): Promise<ProcessingResult> => {
    if (isProcessing) {
      throw new Error('別のファイルを処理中です。完了をお待ちください。')
    }

    isProcessing = true
    shouldCancel = false
    const win = BrowserWindow.fromWebContents(event.sender)
    let tempWavPath: string | null = null

    try {
      // 入力ファイル検証
      if (!fs.existsSync(filePath)) {
        throw new Error('ファイルが見つかりません。パスを確認してください。')
      }

      const ext = path.extname(filePath).toLowerCase()
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        throw new Error(
          `非対応のファイル形式です (${ext})。\n対応形式: ${SUPPORTED_EXTENSIONS.join(', ')}`
        )
      }

      // ファイルサイズチェック
      const stat = fs.statSync(filePath)
      const sizeMB = stat.size / (1024 * 1024)
      if (sizeMB > 2000) {
        throw new Error('ファイルサイズが大きすぎます（2GB以上）。短いファイルでお試しください。')
      }

      // Phase 1: 音声抽出/変換
      sendProgress(win, {
        phase: 'extracting-audio',
        progress: 0,
        message: '音声を抽出しています...'
      })

      if (isVideoFile(filePath)) {
        tempWavPath = await extractAudio(filePath, (p) => {
          sendProgress(win, {
            phase: 'extracting-audio',
            progress: p,
            message: `音声を抽出中... ${p}%`
          })
        })
      } else {
        // 音声ファイルの場合もWAV 16kHzに変換
        tempWavPath = await convertToWav(filePath, (p) => {
          sendProgress(win, {
            phase: 'extracting-audio',
            progress: p,
            message: `音声を変換中... ${p}%`
          })
        })
      }

      if (shouldCancel) throw new Error('処理がキャンセルされました。')

      // Phase 2: モデル読み込み
      sendProgress(win, {
        phase: 'loading-model',
        progress: 0,
        message: 'AIモデルを準備しています...(初回は数分かかります)'
      })

      await loadModel((p) => {
        sendProgress(win, {
          phase: 'loading-model',
          progress: p,
          message: `AIモデルをダウンロード中... ${p}%`
        })
      })

      if (shouldCancel) throw new Error('処理がキャンセルされました。')

      // Phase 3: 文字起こし
      sendProgress(win, {
        phase: 'transcribing',
        progress: 0,
        message: '文字起こし中...(しばらくお待ちください)'
      })

      const transcription = await transcribe(tempWavPath, (p) => {
        sendProgress(win, {
          phase: 'transcribing',
          progress: p,
          message: `文字起こし中... ${p}%`
        })
      })

      if (shouldCancel) throw new Error('処理がキャンセルされました。')

      if (!transcription.fullText.trim()) {
        throw new Error('音声から文字を認識できませんでした。ファイルに音声が含まれているか確認してください。')
      }

      // Phase 4: テキスト分析
      sendProgress(win, {
        phase: 'analyzing',
        progress: 50,
        message: '要約・キーワードを抽出中...'
      })

      const { summary, bulletPoints, keywords } = processText(transcription)

      sendProgress(win, {
        phase: 'done',
        progress: 100,
        message: '処理が完了しました'
      })

      return {
        transcription,
        summary,
        bulletPoints,
        keywords
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '予期しないエラーが発生しました'
      sendProgress(win, {
        phase: 'error',
        progress: 0,
        message
      })
      throw new Error(message)
    } finally {
      isProcessing = false
      if (tempWavPath) {
        cleanupTempFile(tempWavPath)
      }
    }
  })

  // キャンセル
  ipcMain.on('cancel-processing', () => {
    shouldCancel = true
  })

  // エクスポート
  ipcMain.handle('export-result', async (_event, result: ProcessingResult, options: ExportOptions) => {
    const extensions: Record<ExportFormat, string> = {
      txt: 'txt',
      md: 'md',
      json: 'json'
    }

    const dialogResult = await dialog.showSaveDialog({
      title: '結果を保存',
      defaultPath: `文字起こし結果_${formatDate()}.${extensions[options.format]}`,
      filters: [
        { name: `${options.format.toUpperCase()}ファイル`, extensions: [extensions[options.format]] }
      ]
    })

    if (dialogResult.canceled || !dialogResult.filePath) return null

    const content = formatExport(result, options)
    fs.writeFileSync(dialogResult.filePath, content, 'utf-8')
    return dialogResult.filePath
  })
}

function formatDate(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
}

function formatExport(result: ProcessingResult, options: ExportOptions): string {
  if (options.format === 'json') {
    const data: Record<string, unknown> = {}
    if (options.includeTranscription) data.transcription = result.transcription
    if (options.includeSummary) data.summary = result.summary
    if (options.includeBulletPoints) data.bulletPoints = result.bulletPoints
    if (options.includeKeywords) data.keywords = result.keywords
    return JSON.stringify(data, null, 2)
  }

  const isMd = options.format === 'md'
  const sections: string[] = []
  const heading = (title: string) => isMd ? `## ${title}` : `【${title}】`
  const divider = isMd ? '\n---\n' : '\n' + '='.repeat(40) + '\n'

  if (options.includeTranscription) {
    sections.push(heading('文字起こし'))
    if (result.transcription.segments.length > 1) {
      for (const seg of result.transcription.segments) {
        const time = formatTime(seg.start)
        sections.push(`${isMd ? `**${time}**` : `[${time}]`} ${seg.text}`)
      }
    } else {
      sections.push(result.transcription.fullText)
    }
  }

  if (options.includeSummary) {
    sections.push(divider + heading('要約（短）'))
    sections.push(result.summary.short)
    sections.push('')
    sections.push(heading('要約（標準）'))
    sections.push(result.summary.standard)
  }

  if (options.includeBulletPoints) {
    sections.push(divider + heading('重要ポイント'))
    for (const point of result.bulletPoints) {
      sections.push(`${isMd ? '-' : '・'} ${point}`)
    }
  }

  if (options.includeKeywords) {
    sections.push(divider + heading('キーワード'))
    const kwList = result.keywords.map(k => k.word).join(isMd ? ', ' : '、')
    sections.push(kwList)
  }

  return sections.join('\n')
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

export function cleanupHandlers() {
  disposeModel()
}
