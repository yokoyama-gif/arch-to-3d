// ============================================================
// workflows/slide-create.ts
// NotebookLM からスライドを生成し、URL を返す
// ============================================================

import { Page } from 'playwright';
import { SELECTORS } from '../config.js';
import { LimitReachedError } from '../types.js';
import { logger } from '../logger.js';
import { screenshot } from '../browser/launch.js';
import { clickFirst, pageContainsAny, getPageText, findFirst } from '../browser/selectors.js';
import { parseResetTime } from '../utils/time.js';
import { sleep } from '../utils/sleep.js';

export interface SlideCreateResult {
  slideUrl: string;
}

export async function createSlide(
  page: Page,
  themeId: string,
  projectId: string,
): Promise<SlideCreateResult> {
  logger.theme(themeId, 'SLIDE', 'スライド生成開始...');

  // ノートブックへ移動
  if (!page.url().startsWith(projectId)) {
    await page.goto(projectId, { waitUntil: 'domcontentloaded' });
    await sleep(2_000);
  }

  await screenshot(page, `${themeId}_slide_start`);

  // ──────────────────────────────────────────
  // プレゼンテーション生成ボタン
  // ──────────────────────────────────────────
  await clickFirst(
    page,
    SELECTORS.notebooklm.generatePresentationButton,
    'generate presentation',
    15_000,
  );

  logger.theme(themeId, 'SLIDE', 'スライド生成中...');
  await sleep(5_000);
  await screenshot(page, `${themeId}_slide_generating`);

  // ──────────────────────────────────────────
  // 生成完了を待つ（新しいタブ or URL 変化を検知）
  // ──────────────────────────────────────────
  const slideUrl = await waitForSlideUrl(page, themeId);

  logger.theme(themeId, 'SLIDE', `スライド作成完了: ${slideUrl}`);
  await screenshot(page, `${themeId}_slide_done`);

  return { slideUrl };
}

async function waitForSlideUrl(page: Page, themeId: string): Promise<string> {
  const deadline = Date.now() + 5 * 60_000; // 最大5分待機

  while (Date.now() < deadline) {
    // Google Slides URL を検出
    const url = page.url();
    if (url.includes('docs.google.com/presentation')) {
      return url;
    }

    // 新規タブが開いた場合
    const context = page.context();
    const pages = context.pages();
    for (const p of pages) {
      if (p !== page && p.url().includes('docs.google.com/presentation')) {
        const slideUrl = p.url();
        await p.bringToFront();
        return slideUrl;
      }
    }

    // 制限チェック
    const { found, matched } = await pageContainsAny(page, SELECTORS.notebooklm.limitMessages);
    if (found) {
      const fullText = await getPageText(page);
      const resetAt = parseResetTime(fullText);
      throw new LimitReachedError({
        service: 'slides',
        message: matched ?? '利用制限',
        resetAt,
      });
    }

    // 完了リンクボタン検索
    const openLink = await findFirst(
      page,
      [
        'a[href*="docs.google.com/presentation"]',
        'button:has-text("スライドを開く")',
        'button:has-text("Open slides")',
        'a:has-text("プレゼンテーションを開く")',
      ],
      3_000,
    );
    if (openLink) {
      const href = await openLink.getAttribute('href');
      if (href) return href;
      await openLink.click();
      await sleep(2_000);
      return page.url();
    }

    logger.theme(themeId, 'SLIDE', 'スライド生成待機中...');
    await sleep(15_000);
  }

  // タイムアウト時はダミーURLを返してスキップ可能にする
  logger.warn(`[${themeId}] スライド生成タイムアウト。後で確認が必要`);
  return `TIMEOUT:${projectId}`;
}

// projectId を外部から参照できるようにするため変数として保持
let projectId = '';
export function setProjectId(id: string) { projectId = id; }
