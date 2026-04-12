// ============================================================
// workflows/deepresearch-monitor.ts
// Deep Research の完了を監視する
// ============================================================

import { Page } from 'playwright';
import { SELECTORS, CONCURRENCY } from '../config.js';
import { LimitReachedError, RetryableError } from '../types.js';
import { logger } from '../logger.js';
import { screenshot } from '../browser/launch.js';
import { pageContainsAny, findFirst, getPageText } from '../browser/selectors.js';
import { sleep } from '../utils/sleep.js';
import { parseResetTime } from '../utils/time.js';

export async function waitForDeepResearch(
  page: Page,
  themeId: string,
  jobId: string,
): Promise<void> {
  logger.theme(themeId, 'DR_MONITOR', `完了待ち開始: ${jobId}`);

  const deadline = Date.now() + CONCURRENCY.maxMonitorWaitMs;

  while (Date.now() < deadline) {
    // ──────────────────────────────────────────
    // ページが正しいURLか確認
    // ──────────────────────────────────────────
    if (!page.url().includes(jobId.split('/').pop() ?? '')) {
      try {
        await page.goto(jobId, { waitUntil: 'domcontentloaded' });
        await sleep(2_000);
      } catch {
        // ナビ失敗は無視して次のポーリングへ
      }
    }

    await screenshot(page, `${themeId}_monitor`);

    // ──────────────────────────────────────────
    // 制限到達チェック
    // ──────────────────────────────────────────
    {
      const { found, matched } = await pageContainsAny(page, SELECTORS.gemini.limitMessages);
      if (found) {
        const fullText = await getPageText(page);
        const resetAt = parseResetTime(fullText);
        throw new LimitReachedError({
          service: 'deepresearch',
          message: matched ?? '利用制限',
          resetAt,
        });
      }
    }

    // ──────────────────────────────────────────
    // 完了チェック
    // ──────────────────────────────────────────
    {
      const { found } = await pageContainsAny(page, SELECTORS.gemini.completedIndicators);
      if (found) {
        logger.theme(themeId, 'DR_MONITOR', 'Deep Research 完了を確認');
        return;
      }
    }

    // ──────────────────────────────────────────
    // 進行中チェック
    // ──────────────────────────────────────────
    {
      const running = await findFirst(page, SELECTORS.gemini.runningIndicator, 3_000);
      if (running) {
        logger.theme(themeId, 'DR_MONITOR', '処理中... 次回ポーリングまで待機');
      } else {
        logger.warn(`[${themeId}] 進行中インジケーターが見つかりません（ページ状態を確認）`);
      }
    }

    await sleep(CONCURRENCY.monitorIntervalMs);
  }

  throw new RetryableError(`[${themeId}] タイムアウト: Deep Research が ${CONCURRENCY.maxMonitorWaitMs / 60000}分以内に完了しませんでした`);
}
