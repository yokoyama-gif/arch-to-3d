// ============================================================
// state-manager.ts — state.json の読み書き（アトミック更新）
// ============================================================

import fs from 'fs';
import path from 'path';
import { PATHS } from './config.js';
import { AppState, ThemeState, ThemeStatus } from './types.js';
import { nowIso } from './utils/time.js';
import { logger } from './logger.js';

const STATE_VERSION = 1;

// ──────────────────────────────────────────
// 読み込み
// ──────────────────────────────────────────
export function loadState(): AppState {
  if (!fs.existsSync(PATHS.state)) {
    return createEmptyState();
  }
  try {
    const raw = fs.readFileSync(PATHS.state, 'utf8');
    return JSON.parse(raw) as AppState;
  } catch (err) {
    logger.warn('state.json の読み込みに失敗。新規作成します', { error: String(err) });
    return createEmptyState();
  }
}

function createEmptyState(): AppState {
  return {
    version: STATE_VERSION,
    updatedAt: nowIso(),
    themes: [],
  };
}

// ──────────────────────────────────────────
// 保存（アトミック: tmp → rename）
// ──────────────────────────────────────────
export function saveState(state: AppState): void {
  state.updatedAt = nowIso();
  const json = JSON.stringify(state, null, 2);
  const tmp = PATHS.state + '.tmp';
  try {
    fs.mkdirSync(PATHS.data, { recursive: true });
    fs.writeFileSync(tmp, json, 'utf8');
    fs.renameSync(tmp, PATHS.state);
  } catch (err) {
    logger.error('state.json の保存に失敗', { error: String(err) });
    throw err;
  }
}

// ──────────────────────────────────────────
// テーマ操作ヘルパー
// ──────────────────────────────────────────

/** テーマを追加（既存なら上書きしない） */
export function upsertTheme(state: AppState, theme: ThemeState): void {
  const idx = state.themes.findIndex(t => t.id === theme.id);
  if (idx === -1) {
    state.themes.push(theme);
  } else {
    state.themes[idx] = theme;
  }
}

/** 特定テーマの状態だけ部分更新して即保存 */
export function updateTheme(
  state: AppState,
  themeId: string,
  patch: Partial<ThemeState>,
): ThemeState {
  const theme = state.themes.find(t => t.id === themeId);
  if (!theme) throw new Error(`theme not found: ${themeId}`);
  Object.assign(theme, patch);
  saveState(state);
  return theme;
}

/** ステータス変更 + 即保存 */
export function setStatus(
  state: AppState,
  themeId: string,
  status: ThemeStatus,
  extra?: Partial<ThemeState>,
): void {
  updateTheme(state, themeId, { status, ...extra });
  logger.theme(themeId, 'STATUS', `→ ${status}`);
}

/** 現在 deepresearch_running のテーマ数 */
export function countRunningDeepResearch(state: AppState): number {
  return state.themes.filter(t => t.status === 'deepresearch_running').length;
}

/** pending テーマ一覧 */
export function pendingThemes(state: AppState): ThemeState[] {
  return state.themes.filter(t => t.status === 'pending');
}

/** 未完了テーマ一覧（completed / error 以外） */
export function incompleteThemes(state: AppState): ThemeState[] {
  return state.themes.filter(t => t.status !== 'completed');
}

/** 全件完了か */
export function allCompleted(state: AppState): boolean {
  return state.themes.every(t => t.status === 'completed' || t.status === 'error');
}

/** cooldownUntil が過去になった waiting_limit_reset テーマを pending に戻す */
export function releaseCooldowns(state: AppState): void {
  const now = Date.now();
  for (const theme of state.themes) {
    if (
      theme.status === 'waiting_limit_reset' &&
      theme.cooldownUntil &&
      new Date(theme.cooldownUntil).getTime() <= now
    ) {
      // どのステップから再開するか
      theme.status = theme.deepresearchStatus === 'completed' ? 'deepresearch_completed' : 'pending';
      theme.cooldownUntil = null;
      logger.theme(theme.id, 'COOLDOWN', 'クールダウン解除 → 再開');
    }
  }
  saveState(state);
}

/** デフォルト ThemeState を生成 */
export function makeThemeState(input: { id: string; title: string; prompt: string }): ThemeState {
  return {
    ...input,
    status: 'pending',
    deepresearchStatus: 'pending',
    notebooklmStatus: 'pending',
    slideStatus: 'pending',
    startedAt: null,
    completedAt: null,
    retryCount: 0,
    lastError: null,
    cooldownUntil: null,
    deepresearchJobId: null,
    deepresearchContent: null,
    notebooklmProjectId: null,
    slideUrl: null,
    notes: '',
  };
}
