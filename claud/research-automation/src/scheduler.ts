// ============================================================
// scheduler.ts — クールダウン管理・待機ロジック
// ============================================================

import { AppState, LimitReachedError, ThemeState } from './types.js';
import { setStatus, updateTheme, saveState, releaseCooldowns } from './state-manager.js';
import { logger } from './logger.js';
import { sleep, sleepUntil } from './utils/sleep.js';
import { parseResetTime, msUntil, formatDuration, nowIso } from './utils/time.js';
import { RETRY } from './config.js';

/**
 * LimitReachedError を受け取り、テーマの状態を waiting_limit_reset に更新する。
 * 解除時刻が判明すればそれを、不明なら段階的バックオフ時刻を設定する。
 */
export function handleLimitReached(
  state: AppState,
  theme: ThemeState,
  err: LimitReachedError,
): void {
  let resetAt = err.info.resetAt;

  if (!resetAt) {
    // 段階的バックオフ
    const backoffIndex = Math.min(theme.retryCount, RETRY.backoffMs.length - 1);
    const backoffMs = RETRY.backoffMs[backoffIndex];
    resetAt = new Date(Date.now() + backoffMs).toISOString();
    logger.warn(`[${theme.id}] 解除時刻不明 → バックオフ ${formatDuration(backoffMs)} 後に再試行`);
  }

  updateTheme(state, theme.id, {
    status: 'waiting_limit_reset',
    cooldownUntil: resetAt,
    retryCount: theme.retryCount + 1,
    lastError: err.message,
  });

  logger.warn(`[${theme.id}] 制限待機: ${resetAt}`);
}

/**
 * 最短の cooldownUntil まで待機し、定期的に他のテーマを確認できるよう
 * 小刻みに戻ってくる（最大1分間隔）
 */
export async function sleepUntilNextCooldownRelease(state: AppState): Promise<void> {
  const waiting = state.themes.filter(
    t => t.status === 'waiting_limit_reset' && t.cooldownUntil,
  );
  if (waiting.length === 0) return;

  const earliest = waiting
    .map(t => new Date(t.cooldownUntil!).getTime())
    .sort((a, b) => a - b)[0];

  const remainMs = Math.max(0, earliest - Date.now());
  if (remainMs <= 0) return;

  logger.info(`最短クールダウン解除まで ${formatDuration(remainMs)} 待機...`);
  await sleep(Math.min(remainMs, 60_000));
}

/**
 * 処理できるテーマがなく全件 waiting / error 状態の場合に
 * 最短解除時刻まで待機する
 */
export async function waitForAnyCooldown(state: AppState): Promise<void> {
  await sleepUntilNextCooldownRelease(state);
  releaseCooldowns(state);
}
