// ============================================================
// workflows/deepresearch-export.ts
// 完了した Deep Research のテキストを取得する
// ============================================================

import { Page } from 'playwright';
import { SELECTORS } from '../config.js';
import { logger } from '../logger.js';
import { screenshot } from '../browser/launch.js';
import { findFirst, getPageText } from '../browser/selectors.js';
import { sleep } from '../utils/sleep.js';

export async function exportDeepResearchContent(
  page: Page,
  themeId: string,
): Promise<string> {
  logger.theme(themeId, 'DR_EXPORT', 'レポート本文を取得...');

  await sleep(1_000);
  await screenshot(page, `${themeId}_dr_export`);

  // ──────────────────────────────────────────
  // レポートコンテナから取得を試みる
  // ──────────────────────────────────────────
  for (const sel of SELECTORS.gemini.reportContent) {
    try {
      const loc = page.locator(sel).first();
      await loc.waitFor({ state: 'visible', timeout: 5_000 });
      const text = await loc.innerText();
      if (text && text.length > 100) {
        logger.theme(themeId, 'DR_EXPORT', `取得成功 (${text.length} chars) via "${sel}"`);
        return text;
      }
    } catch {
      // 次のセレクタへ
    }
  }

  // ──────────────────────────────────────────
  // フォールバック: ページ全体テキスト
  // ──────────────────────────────────────────
  logger.warn(`[${themeId}] レポートセレクタ不一致 → ページ全文を取得`);
  const fullText = await getPageText(page);

  if (!fullText || fullText.length < 100) {
    throw new Error(`[${themeId}] レポートのテキスト取得に失敗（テキスト長: ${fullText?.length ?? 0}）`);
  }

  logger.theme(themeId, 'DR_EXPORT', `フォールバック取得成功 (${fullText.length} chars)`);
  return fullText;
}
