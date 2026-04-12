// ============================================================
// workflows/notebooklm-create.ts
// NotebookLM に新規ノートブックを作成し、URL を返す
// ============================================================

import { Page } from 'playwright';
import { URLS, SELECTORS } from '../config.js';
import { LimitReachedError } from '../types.js';
import { logger } from '../logger.js';
import { screenshot } from '../browser/launch.js';
import { clickFirst, fillFirst, pageContainsAny, getPageText } from '../browser/selectors.js';
import { parseResetTime } from '../utils/time.js';
import { sleep } from '../utils/sleep.js';

export interface NotebookCreateResult {
  projectId: string;   // ノートブックURL
}

export async function createNotebook(
  page: Page,
  themeId: string,
  title: string,
): Promise<NotebookCreateResult> {
  logger.theme(themeId, 'NLM_CREATE', 'NotebookLM を開く...');
  await page.goto(URLS.notebooklm, { waitUntil: 'domcontentloaded' });
  await sleep(2_000);
  await screenshot(page, `${themeId}_nlm_open`);

  // ──────────────────────────────────────────
  // 制限チェック
  // ──────────────────────────────────────────
  await checkLimit(page, themeId);

  // ──────────────────────────────────────────
  // 新規ノートブック作成ボタン
  // ──────────────────────────────────────────
  logger.theme(themeId, 'NLM_CREATE', '新規ノートブック作成...');
  await clickFirst(page, SELECTORS.notebooklm.newNotebookButton, 'new notebook');
  await sleep(2_000);
  await screenshot(page, `${themeId}_nlm_new`);

  // ──────────────────────────────────────────
  // タイトル入力（ダイアログが出る場合）
  // ──────────────────────────────────────────
  try {
    await fillFirst(
      page,
      SELECTORS.notebooklm.notebookTitleInput,
      title,
      'notebook title',
      5_000,
    );
    // Enter で確定
    await page.keyboard.press('Enter');
    await sleep(1_500);
  } catch {
    // タイトル入力フォームがない場合はスキップ（後から編集可能）
    logger.warn(`[${themeId}] タイトル入力フォームが見つからず、スキップ`);
  }

  await screenshot(page, `${themeId}_nlm_titled`);

  // ──────────────────────────────────────────
  // 制限チェック（作成後）
  // ──────────────────────────────────────────
  await checkLimit(page, themeId);

  const projectId = page.url();
  logger.theme(themeId, 'NLM_CREATE', `ノートブック作成完了 projectId=${projectId}`);

  return { projectId };
}

async function checkLimit(page: Page, themeId: string): Promise<void> {
  const { found, matched } = await pageContainsAny(page, SELECTORS.notebooklm.limitMessages);
  if (!found) return;

  const fullText = await getPageText(page);
  const resetAt = parseResetTime(fullText);

  logger.warn(`[${themeId}] NotebookLM 利用制限: "${matched}" resetAt=${resetAt}`);
  await screenshot(page, `${themeId}_nlm_limit`);

  throw new LimitReachedError({
    service: 'notebooklm',
    message: matched ?? '利用制限',
    resetAt,
  });
}
