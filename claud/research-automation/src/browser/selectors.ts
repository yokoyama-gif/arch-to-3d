// ============================================================
// browser/selectors.ts — セレクタ検索ユーティリティ
// ============================================================

import { Page, Locator } from 'playwright';
import { logger } from '../logger.js';

/**
 * 複数のセレクタ候補から、最初に見つかった要素を返す
 * 見つからなければ null
 */
export async function findFirst(
  page: Page,
  selectors: readonly string[],
  timeout = 5_000,
): Promise<Locator | null> {
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      await loc.waitFor({ state: 'visible', timeout });
      return loc;
    } catch {
      // 次のセレクタへ
    }
  }
  return null;
}

/**
 * 複数のセレクタから最初に見つかった要素をクリック
 * 失敗したら Error をスロー
 */
export async function clickFirst(
  page: Page,
  selectors: readonly string[],
  label: string,
  timeout = 10_000,
): Promise<void> {
  const loc = await findFirst(page, selectors, timeout);
  if (!loc) {
    throw new Error(`[clickFirst] 要素が見つかりません: ${label}\nSelectors: ${selectors.join(', ')}`);
  }
  logger.debug(`クリック: ${label}`);
  await loc.click();
}

/**
 * 複数のセレクタから最初に見つかった要素にテキストを入力
 */
export async function fillFirst(
  page: Page,
  selectors: readonly string[],
  text: string,
  label: string,
  timeout = 10_000,
): Promise<void> {
  const loc = await findFirst(page, selectors, timeout);
  if (!loc) {
    throw new Error(`[fillFirst] 要素が見つかりません: ${label}`);
  }
  logger.debug(`入力: ${label} = "${text.slice(0, 50)}…"`);
  await loc.fill(text);
}

/**
 * ページテキスト全体から指定パターンのいずれかが含まれるか確認
 */
export async function pageContainsAny(
  page: Page,
  patterns: readonly string[],
): Promise<{ found: boolean; matched: string | null }> {
  const text = await page.evaluate(() => document.body.innerText);
  for (const p of patterns) {
    if (text.toLowerCase().includes(p.toLowerCase())) {
      return { found: true, matched: p };
    }
  }
  return { found: false, matched: null };
}

/**
 * ページ全体のテキストを取得
 */
export async function getPageText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText ?? '');
}
