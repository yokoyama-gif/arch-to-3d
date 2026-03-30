import ffmpeg from 'fluent-ffmpeg'
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg'
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { VIDEO_EXTENSIONS } from '../../shared/types'

ffmpeg.setFfmpegPath(ffmpegPath)

function getTempDir(): string {
  const dir = path.join(app.getPath('temp'), 'audio-summarizer')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function isVideoFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return VIDEO_EXTENSIONS.includes(ext)
}

export function extractAudio(
  inputPath: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(
      getTempDir(),
      `audio_${Date.now()}.wav`
    )

    const command = ffmpeg(inputPath)
      .toFormat('wav')
      .audioFrequency(16000)
      .audioChannels(1)
      .audioCodec('pcm_s16le')
      .on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.min(100, Math.round(progress.percent)))
        }
      })
      .on('end', () => resolve(outputPath))
      .on('error', (err) => {
        reject(new Error(`音声の抽出に失敗しました: ${err.message}`))
      })

    command.save(outputPath)
  })
}

export function convertToWav(
  inputPath: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(
      getTempDir(),
      `converted_${Date.now()}.wav`
    )

    ffmpeg(inputPath)
      .toFormat('wav')
      .audioFrequency(16000)
      .audioChannels(1)
      .audioCodec('pcm_s16le')
      .on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.min(100, Math.round(progress.percent)))
        }
      })
      .on('end', () => resolve(outputPath))
      .on('error', (err) => {
        reject(new Error(`音声ファイルの変換に失敗しました: ${err.message}`))
      })
      .save(outputPath)
  })
}

export function cleanupTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath) && filePath.includes('audio-summarizer')) {
      fs.unlinkSync(filePath)
    }
  } catch {
    // 一時ファイル削除失敗は無視
  }
}

export function cleanupAllTemp(): void {
  try {
    const tempDir = path.join(app.getPath('temp'), 'audio-summarizer')
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir)
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file))
      }
    }
  } catch {
    // クリーンアップ失敗は無視
  }
}
