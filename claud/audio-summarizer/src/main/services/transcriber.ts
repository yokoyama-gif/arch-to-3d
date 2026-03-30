import { TranscriptionResult, TranscriptionSegment } from '../../shared/types'

let pipeline: any = null
let currentModel: string = 'Xenova/whisper-small'

async function getTransformersPipeline() {
  // Dynamic import for @xenova/transformers
  const { pipeline: createPipeline, env } = await import('@xenova/transformers')

  // モデルキャッシュをアプリデータフォルダに設定
  env.cacheDir = undefined // デフォルトのキャッシュディレクトリを使用

  return createPipeline
}

export async function loadModel(
  onProgress?: (progress: number) => void
): Promise<void> {
  if (pipeline) return

  const createPipeline = await getTransformersPipeline()

  pipeline = await createPipeline(
    'automatic-speech-recognition',
    currentModel,
    {
      progress_callback: (data: any) => {
        if (data.status === 'progress' && onProgress) {
          onProgress(Math.round(data.progress || 0))
        }
      }
    }
  )
}

export async function transcribe(
  audioPath: string,
  onProgress?: (progress: number) => void
): Promise<TranscriptionResult> {
  if (!pipeline) {
    throw new Error('モデルが読み込まれていません。先にloadModel()を呼んでください。')
  }

  const result = await pipeline(audioPath, {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
    language: 'japanese',
    task: 'transcribe'
  })

  const segments: TranscriptionSegment[] = []
  let fullText = ''

  if (result.chunks && Array.isArray(result.chunks)) {
    for (const chunk of result.chunks) {
      const text = chunk.text?.trim() || ''
      if (text) {
        segments.push({
          start: chunk.timestamp?.[0] ?? 0,
          end: chunk.timestamp?.[1] ?? 0,
          text
        })
        fullText += text
      }
    }
  } else {
    fullText = result.text?.trim() || ''
    if (fullText) {
      segments.push({ start: 0, end: 0, text: fullText })
    }
  }

  // 言語判定（簡易）
  const language = detectLanguage(fullText)

  return { fullText, segments, language }
}

function detectLanguage(text: string): string {
  const cjkPattern = /[\u3000-\u9FFF\uF900-\uFAFF]/
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF]/
  if (japanesePattern.test(text)) return 'ja'
  if (cjkPattern.test(text)) return 'zh'
  return 'en'
}

export function disposeModel(): void {
  pipeline = null
}
