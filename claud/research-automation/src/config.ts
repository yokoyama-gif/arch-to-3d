// ============================================================
// config.ts — すべての設定・セレクタを集約
// ============================================================

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ──────────────────────────────────────────
// パス設定
// ──────────────────────────────────────────
export const PATHS = {
  root: ROOT,
  data: path.join(ROOT, 'data'),
  themes: path.join(ROOT, 'data', 'themes.json'),
  state: path.join(ROOT, 'data', 'state.json'),
  logs: path.join(ROOT, 'logs'),
  screenshots: path.join(ROOT, 'screenshots'),
} as const;

// ──────────────────────────────────────────
// 同時実行制御
// ──────────────────────────────────────────
export const CONCURRENCY = {
  maxDeepResearch: 3,
  mainLoopIntervalMs: 30_000,   // 30秒ごとにポーリング
  monitorIntervalMs: 60_000,    // 完了監視の間隔
  maxMonitorWaitMs: 30 * 60_000, // 最大30分待機
} as const;

// ──────────────────────────────────────────
// リトライ設定
// ──────────────────────────────────────────
export const RETRY = {
  maxAttempts: 5,
  /** 段階的バックオフ (ms) */
  backoffMs: [5 * 60_000, 15 * 60_000, 30 * 60_000, 60 * 60_000],
  defaultDelayMs: 3_000,
} as const;

// ──────────────────────────────────────────
// URL
// ──────────────────────────────────────────
export const URLS = {
  geminiDeepResearch: 'https://gemini.google.com/app',
  notebooklm: 'https://notebooklm.google.com/',
  googleSlides: 'https://docs.google.com/presentation/create',
} as const;

// ──────────────────────────────────────────
// Gemini Deep Research セレクタ
// NOTE: 実際の DOM を確認し差し替えること
// ──────────────────────────────────────────
export const SELECTORS = {
  gemini: {
    /** 新規チャット / 入力欄 */
    inputArea: [
      'div[contenteditable="true"]',
      'rich-textarea .ql-editor',
      'textarea[placeholder]',
    ],
    /** 送信ボタン */
    submitButton: [
      'button[aria-label="送信"]',
      'button[aria-label="Send message"]',
      'button[data-test-id="send-button"]',
    ],
    /** Deep Research モード切替ボタン */
    deepResearchToggle: [
      'button[aria-label*="Deep Research"]',
      'button[aria-label*="詳細なリサーチ"]',
      '[data-test-id="deep-research-button"]',
    ],
    /** リサーチ開始確認ボタン */
    startResearchButton: [
      'button:has-text("リサーチを開始")',
      'button:has-text("Start research")',
    ],
    /** 進行中インジケーター */
    runningIndicator: [
      '[aria-label*="進行中"]',
      '.research-progress',
      '[data-state="running"]',
    ],
    /** 完了判定テキスト */
    completedIndicators: [
      'リサーチが完了しました',
      'Research complete',
      'Deep Research complete',
    ],
    /** レポート本文コンテナ */
    reportContent: [
      '.research-report',
      '[data-test-id="research-report"]',
      'article.report',
      '.model-response-text',
    ],
    /** 制限メッセージ判定テキスト */
    limitMessages: [
      '上限に達しました',
      '利用制限',
      'You\'ve reached the limit',
      'daily limit',
      'しばらくしてから',
      'Try again later',
    ],
    /** 新規チャットボタン */
    newChatButton: [
      'a[href="/app"]',
      'button:has-text("新しいチャット")',
      'button:has-text("New chat")',
    ],
  },

  notebooklm: {
    /** 新規ノートブック作成ボタン */
    newNotebookButton: [
      'button:has-text("新しいノートブック")',
      'button:has-text("New notebook")',
      '[data-test-id="new-notebook"]',
    ],
    /** ソース追加ボタン */
    addSourceButton: [
      'button:has-text("ソースを追加")',
      'button:has-text("Add source")',
      '[aria-label*="add source"]',
    ],
    /** テキスト貼り付けオプション */
    pasteTextOption: [
      'button:has-text("テキストを貼り付け")',
      'button:has-text("Paste text")',
      '[data-source-type="text"]',
    ],
    /** テキスト入力エリア */
    textInputArea: [
      'textarea[placeholder*="テキスト"]',
      'textarea[placeholder*="text"]',
      '.source-text-input textarea',
    ],
    /** ソース確認ボタン */
    confirmSourceButton: [
      'button:has-text("追加")',
      'button:has-text("Add")',
      'button:has-text("保存")',
    ],
    /** ノートブックタイトル入力 */
    notebookTitleInput: [
      'input[placeholder*="タイトル"]',
      'input[placeholder*="title"]',
    ],
    /** プレゼンテーション生成ボタン */
    generatePresentationButton: [
      'button:has-text("プレゼンテーション")',
      'button:has-text("Presentation")',
      '[data-action="generate-slides"]',
    ],
    /** 制限メッセージ */
    limitMessages: [
      '上限に達しました',
      'ノートブックの上限',
      'You\'ve reached the limit',
      'notebook limit',
    ],
    /** ノートブック一覧の各アイテム */
    notebookListItem: [
      '.notebook-item',
      '[data-test-id="notebook-card"]',
    ],
  },
} as const;

// ──────────────────────────────────────────
// Playwright 設定
// ──────────────────────────────────────────
export const BROWSER = {
  headless: true,            // GUI なし環境では true が必須
  slowMo: 200,               // 操作間隔 (ms)
  viewportWidth: 1280,
  viewportHeight: 900,
  userDataDir: path.join(ROOT, '.browser-profile'), // Google ログイン情報を保持
  screenshotOnStep: true,
} as const;
