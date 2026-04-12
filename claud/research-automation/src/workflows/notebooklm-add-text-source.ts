// ============================================================
// workflows/notebooklm-add-text-source.ts
// Deep Research の本文を NotebookLM にテキストソースとして追加する
// ============================================================

import { Page } from 'playwright';
import { SELECTORS } from '../config.js';
import { LimitReachedError } from '../types.js';
import { logger } from '../logger.js';
import { screenshot } from '../browser/launch.js';
import { clickFirst, fillFirst, pageContainsAny, getPageText } from '../browser/selectors.js';
import { chunkText } from '../utils/text.js';
import { parseResetTime } from '../utils/time.js';
import { sleep } from '../utils/sleep.js';

export async function addTextSource(
  page: Page,
  themeId: string,
  projectId: string,
  text: string,
  sourceTitle: string,
): Promise<void> {
  logger.theme(themeId, 'NLM_SOURCE', `ノートブックを開く: ${projectId}`);

  // ノートブックに移動（すでに表示中ならスキップ）
  if (!page.url().includes(projectId.split('/').slice(-2).join('/'))) {
    await page.goto(projectId, { waitUntil: 'domcontentloaded' });
    await sleep(2_000);
  }

  await screenshot(page, `${themeId}_nlm_source_open`);

  // テキストが長い場合は分割して投入
  const chunks = chunkText(text);
  logger.theme(themeId, 'NLM_SOURCE', `テキスト分割数: ${chunks.length}`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkLabel = chunks.length > 1 ? `${sourceTitle} [${i + 1}/${chunks.length}]` : sourceTitle;

    logger.theme(themeId, 'NLM_SOURCE', `ソース追加 (${i + 1}/${chunks.length})...`);
    await addSingleTextSource(page, themeId, chunk, chunkLabel);
    await sleep(1_500);
  }

  logger.theme(themeId, 'NLM_SOURCE', 'テキストソース追加完了');
}

async function addSingleTextSource(
  page: Page,
  themeId: string,
  text: string,
  title: string,
): Promise<void> {
  // ──────────────────────────────────────────
  // ソースを追加ボタンをクリック
  // ──────────────────────────────────────────
  await clickFirst(page, SELECTORS.notebooklm.addSourceButton, 'add source');
  await sleep(1_000);
  await screenshot(page, `${themeId}_nlm_add_source_menu`);

  // ──────────────────────────────────────────
  // 「テキストを貼り付け」を選択
  // ──────────────────────────────────────────
  await clickFirst(page, SELECTORS.notebooklm.pasteTextOption, 'paste text option');
  await sleep(1_000);
  await screenshot(page, `${themeId}_nlm_paste_dialog`);

  // ──────────────────────────────────────────
  // テキスト入力
  // ──────────────────────────────────────────
  // fillFirst は大量テキストで遅いので、evaluate で直接設定してから input イベントを発火
  try {
    await fillFirst(page, SELECTORS.notebooklm.textInputArea, text, 'source text');
  } catch {
    // textarea が見つからない場合、contenteditable を試す
    await page.evaluate((txt) => {
      const el = document.querySelector('[contenteditable="true"]') as HTMLElement;
      if (el) { el.innerText = txt; el.dispatchEvent(new Event('input', { bubbles: true })); }
    }, text);
  }

  await sleep(500);

  // ──────────────────────────────────────────
  // 確認・追加ボタン
  // ──────────────────────────────────────────
  await clickFirst(page, SELECTORS.notebooklm.confirmSourceButton, 'confirm add source');
  await sleep(3_000);
  await screenshot(page, `${themeId}_nlm_source_added`);

  // ──────────────────────────────────────────
  // 制限チェック
  // ──────────────────────────────────────────
  const { found, matched } = await pageContainsAny(page, SELECTORS.notebooklm.limitMessages);
  if (found) {
    const fullText = await getPageText(page);
    const resetAt = parseResetTime(fullText);
    throw new LimitReachedError({
      service: 'notebooklm',
      message: matched ?? '利用制限',
      resetAt,
    });
  }
}
