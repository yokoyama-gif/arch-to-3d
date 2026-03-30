export interface TranscriptionSegment {
  start: number
  end: number
  text: string
}

export interface TranscriptionResult {
  fullText: string
  segments: TranscriptionSegment[]
  language: string
}

export interface SummaryResult {
  short: string
  standard: string
  detailed: string
}

export interface ProcessingResult {
  transcription: TranscriptionResult
  summary: SummaryResult
  bulletPoints: string[]
  keywords: KeywordEntry[]
}

export interface KeywordEntry {
  word: string
  score: number
}

export type ProcessingPhase =
  | 'idle'
  | 'extracting-audio'
  | 'loading-model'
  | 'transcribing'
  | 'analyzing'
  | 'done'
  | 'error'

export interface ProgressUpdate {
  phase: ProcessingPhase
  progress: number // 0-100
  message: string
}

export type ExportFormat = 'txt' | 'md' | 'json'

export interface ExportOptions {
  format: ExportFormat
  includeTranscription: boolean
  includeSummary: boolean
  includeBulletPoints: boolean
  includeKeywords: boolean
}

export const SUPPORTED_EXTENSIONS = [
  '.mp4', '.mov', '.m4a', '.mp3', '.wav',
  '.avi', '.mkv', '.webm', '.ogg', '.flac', '.aac', '.wma'
]

export const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm']
export const AUDIO_EXTENSIONS = ['.m4a', '.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma']

export interface ElectronAPI {
  processFile: (filePath: string) => Promise<ProcessingResult>
  onProgress: (callback: (update: ProgressUpdate) => void) => () => void
  selectFile: () => Promise<string | null>
  exportResult: (result: ProcessingResult, options: ExportOptions) => Promise<string | null>
  cancelProcessing: () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
