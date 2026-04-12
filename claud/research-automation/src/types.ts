// ============================================================
// types.ts — 全型定義
// ============================================================

export type ThemeStatus =
  | 'pending'
  | 'deepresearch_running'
  | 'deepresearch_completed'
  | 'notebooklm_created'
  | 'source_added'
  | 'slide_created'
  | 'completed'
  | 'waiting_limit_reset'
  | 'error';

export type DeepResearchStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'limit_reached';

export type NotebookLMStatus =
  | 'pending'
  | 'created'
  | 'source_added'
  | 'failed'
  | 'limit_reached';

export type SlideStatus =
  | 'pending'
  | 'created'
  | 'failed';

// ──────────────────────────────────────────
// themes.json の1エントリ
// ──────────────────────────────────────────
export interface ThemeInput {
  id: string;
  title: string;
  prompt: string;
}

// ──────────────────────────────────────────
// state.json の1エントリ（テーマごと）
// ──────────────────────────────────────────
export interface ThemeState extends ThemeInput {
  status: ThemeStatus;
  deepresearchStatus: DeepResearchStatus;
  notebooklmStatus: NotebookLMStatus;
  slideStatus: SlideStatus;

  startedAt: string | null;
  completedAt: string | null;
  retryCount: number;
  lastError: string | null;

  /** ISO string: この時刻まで待機 */
  cooldownUntil: string | null;

  /** Gemini 側のジョブ識別子（URL / ページタイトル等） */
  deepresearchJobId: string | null;

  /** Gemini が返したリサーチ本文テキスト */
  deepresearchContent: string | null;

  /** NotebookLM のプロジェクト識別子（URL） */
  notebooklmProjectId: string | null;

  /** 作成されたスライドの URL */
  slideUrl: string | null;

  notes: string;
}

// ──────────────────────────────────────────
// state.json ルート
// ──────────────────────────────────────────
export interface AppState {
  version: number;
  updatedAt: string;
  themes: ThemeState[];
}

// ──────────────────────────────────────────
// 制限到達エラー
// ──────────────────────────────────────────
export interface LimitReachedInfo {
  service: 'deepresearch' | 'notebooklm' | 'slides';
  message: string;
  /** ISO string or null */
  resetAt: string | null;
}

export class LimitReachedError extends Error {
  constructor(public info: LimitReachedInfo) {
    super(`[LimitReached:${info.service}] ${info.message}`);
    this.name = 'LimitReachedError';
  }
}

export class RetryableError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'RetryableError';
  }
}
