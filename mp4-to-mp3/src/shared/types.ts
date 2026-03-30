// ===== ジョブ管理 =====

export type JobStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ConversionJob {
  id: string;
  inputPath: string;
  fileName: string;
  duration: number | null;
  status: JobStatus;
  progress: number; // 0-100
  outputFiles: string[];
  errorMessage: string | null;
}

// ===== 変換オプション =====

export interface ConversionOptions {
  outputFormat: 'mp3';
  bitrate: number; // kbps
  normalize: boolean;
  silenceRemove: boolean;
  silenceThreshold: number; // dB (例: -30)
  silenceMinDuration: number; // 秒 (例: 0.5)
  speedUp: boolean;
  speeds: number[]; // 例: [1.5, 2.0]
  outputDir: string;
  outputToSameDir: boolean;
}

// ===== 変換タスク (内部用) =====

export interface ConversionTask {
  jobId: string;
  inputPath: string;
  outputPath: string;
  options: ConversionOptions;
  speed: number | null; // null = 通常速度
}

// ===== 変換結果 =====

export interface ConversionResult {
  jobId: string;
  success: boolean;
  outputFiles: string[];
  errorMessage: string | null;
}

// ===== 設定 =====

export interface AppSettings {
  outputFormat: 'mp3';
  bitrate: number;
  normalize: boolean;
  silenceRemove: boolean;
  silenceThreshold: number;
  silenceMinDuration: number;
  speedUp: boolean;
  speeds: number[];
  outputDir: string;
  outputToSameDir: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  outputFormat: 'mp3',
  bitrate: 192,
  normalize: false,
  silenceRemove: false,
  silenceThreshold: -30,
  silenceMinDuration: 0.5,
  speedUp: false,
  speeds: [1.5],
  outputDir: '',
  outputToSameDir: false,
};

// ===== IPC チャンネル =====

export const IPC_CHANNELS = {
  SELECT_FILES: 'select-files',
  SELECT_FOLDER: 'select-folder',
  SELECT_OUTPUT_FOLDER: 'select-output-folder',
  START_CONVERSION: 'start-conversion',
  CANCEL_CONVERSION: 'cancel-conversion',
  CANCEL_ALL: 'cancel-all',
  OPEN_FOLDER: 'open-folder',
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  GET_FILE_INFO: 'get-file-info',
  // Main → Renderer events
  JOB_PROGRESS: 'job-progress',
  JOB_COMPLETED: 'job-completed',
  JOB_FAILED: 'job-failed',
  LOG_MESSAGE: 'log-message',
} as const;

// ===== ログ =====

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

// ===== IPC ペイロード =====

export interface StartConversionPayload {
  jobs: Array<{ id: string; inputPath: string }>;
  options: ConversionOptions;
}

export interface JobProgressEvent {
  jobId: string;
  progress: number;
}

export interface JobCompletedEvent {
  jobId: string;
  outputFiles: string[];
}

export interface JobFailedEvent {
  jobId: string;
  errorMessage: string;
}

// ===== Electron API (preload公開) =====

export interface ElectronAPI {
  selectFiles: () => Promise<string[]>;
  selectFolder: () => Promise<string[]>;
  selectOutputFolder: () => Promise<string | null>;
  startConversion: (payload: StartConversionPayload) => Promise<void>;
  cancelConversion: (jobId: string) => Promise<void>;
  cancelAll: () => Promise<void>;
  openFolder: (folderPath: string) => Promise<void>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  onJobProgress: (callback: (event: JobProgressEvent) => void) => () => void;
  onJobCompleted: (callback: (event: JobCompletedEvent) => void) => () => void;
  onJobFailed: (callback: (event: JobFailedEvent) => void) => () => void;
  onLogMessage: (callback: (entry: LogEntry) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
