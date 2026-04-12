// ============================================================
// workflows/deepresearch-create.ts
// Gemini Deep Research を新規作成し、jobId（ページURL）を返す
// ============================================================

import { Page } from 'playwright';
import { URLS, SELECTORS } from '../config.js';
import { LimitReachedError, LimitReachedInfo } from '../types.js';
import { logger } from '../logger.js';
import { screenshot } from '../browser/launch.js';
import { clickFirst, fillFirst, pageContainsAny, getPageText } from '../browser/selectors.js';
import { parseResetTime } from '../utils/time.js';
import { sleep } from '../utils/sleep.js';

export interface DeepResearchCreateResult {
  jobId: string;   // ページURL を識別子として利用
}

export async function createDeepResearch(
  page: Page,
  themeId: string,
  prompt: string,
): Promise<DeepResearchCreateResult> {
  logger.theme(themeId, 'DR_CREATE', 'Gemini を開く...');
  await page.goto(URLS.geminiDeepResearch, { waitUntil: 'domcontentloaded' });
  await sleep(2_000);
  await screenshot(page, `${themeId}_dr_open`);

  // ──────────────────────────────────────────
  // 制限チェック（ページ開いた直後）
  // ──────────────────────────────────────────
  await checkLimit(page, themeId, 'deepresearch');

  // ──────────────────────────────────────────
  // 新規チャット開始
  // ──────────────────────────────────────────
  try {
    await clickFirst(page, SELECTORS.gemini.newChatButton, 'new chat', 5_000);
    await sleep(1_500);
  } catch {
    // すでに新規チャット状態の場合はスキップ
  }

  // ──────────────────────────────────────────
  // Deep Research モードをオンにする
  // ──────────────────────────────────────────
  logger.theme(themeId, 'DR_CREATE', 'Deep Research モードを有効化...');
  await clickFirst(page, SELECTORS.gemini.deepResearchToggle, 'deep research toggle');
  await sleep(1_000);
  await screenshot(page, `${themeId}_dr_toggle`);

  // ──────────────────────────────────────────
  // プロンプト入力
  // ──────────────────────────────────────────
  logger.theme(themeId, 'DR_CREATE', 'プロンプト入力...');
  await fillFirst(page, SELECTORS.gemini.inputArea, prompt, 'prompt input');
  await sleep(500);
  await screenshot(page, `${themeId}_dr_prompt`);

  // ──────────────────────────────────────────
  // 送信
  // ──────────────────────────────────────────
  await clickFirst(page, SELECTORS.gemini.submitButton, 'submit');
  await sleep(2_000);

  // ──────────────────────────────────────────
  // "リサーチを開始" 確認ダイアログが出た場合
  // ──────────────────────────────────────────
  try {
    await clickFirst(page, SELECTORS.gemini.startResearchButton, 'start research confirm', 5_000);
    logger.theme(themeId, 'DR_CREATE', '開始確認ダイアログを承認');
  } catch {
    // ダイアログなし → そのまま続行
  }

  await sleep(2_000);
  await screenshot(page, `${themeId}_dr_started`);

  // ──────────────────────────────────────────
  // 制限チェック（送信後）
  // ──────────────────────────────────────────
  await checkLimit(page, themeId, 'deepresearch');

  const jobId = page.url();
  logger.theme(themeId, 'DR_CREATE', `Deep Research 開始 jobId=${jobId}`);

  return { jobId };
}

// ──────────────────────────────────────────
// 制限到達チェック（共通）
// ──────────────────────────────────────────
async function checkLimit(page: Page, themeId: string, service: LimitReachedInfo['service']): Promise<void> {
  const { found, matched } = await pageContainsAny(page, SELECTORS.gemini.limitMessages);
  if (!found) return;

  const fullText = await getPageText(page);
  const resetAt = parseResetTime(fullText);

  logger.warn(`[${themeId}] 利用制限を検出: "${matched}" resetAt=${resetAt}`);
  await screenshot(page, `${themeId}_limit_reached`);

  throw new LimitReachedError({
    service,
    message: matched ?? '利用制限',
    resetAt,
  });
}
