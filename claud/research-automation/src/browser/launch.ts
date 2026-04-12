// ============================================================
// browser/launch.ts — Playwright ブラウザ管理（シングルトン + mutex）
// ============================================================

import { chromium, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { BROWSER, PATHS } from '../config.js';
import { logger } from '../logger.js';

let _context: BrowserContext | null = null;
let _launching: Promise<BrowserContext> | null = null;  // mutex

// ──────────────────────────────────────────
// シングルトンコンテキスト取得（mutex で競合防止）
// ──────────────────────────────────────────
export async function getBrowserContext(): Promise<BrowserContext> {
  if (_context) return _context;

  // 他の呼び出しがすでに起動中なら同じ Promise を共有
  if (_launching) return _launching;

  _launching = (async () => {
    logger.info('ブラウザ起動中...');

    // Windows では launchPersistentContext の user-data-dir 競合を避けるため
    // 通常の launch + newContext に切り替える
    const browser = await chromium.launch({
      headless: BROWSER.headless,
      slowMo: BROWSER.slowMo,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    _context = await browser.newContext({
      viewport: {
        width: BROWSER.viewportWidth,
        height: BROWSER.viewportHeight,
      },
      // Google ログイン状態を保存するストレージパス
      storageState: await loadStorageState(),
    });

    // ブラウザ終了時にクリーンアップ
    browser.on('disconnected', () => {
      _context = null;
      _launching = null;
      logger.warn('ブラウザが切断されました');
    });

    logger.info('ブラウザ起動完了');
    return _context;
  })();

  try {
    const ctx = await _launching;
    return ctx;
  } catch (err) {
    _launching = null;
    throw err;
  }
}

// ──────────────────────────────────────────
// 新規ページ取得（コンテキスト共有）
// ──────────────────────────────────────────
export async function newPage(): Promise<Page> {
  const ctx = await getBrowserContext();
  const page = await ctx.newPage();
  return page;
}

// ──────────────────────────────────────────
// ブラウザ終了（全ページ含む）
// ──────────────────────────────────────────
export async function closeBrowser(): Promise<void> {
  if (_context) {
    // セッション保存
    await saveStorageState(_context);
    await _context.close();
    _context = null;
    _launching = null;
  }
  logger.info('ブラウザ終了');
}

// ──────────────────────────────────────────
// Google ログイン状態の永続化
// ──────────────────────────────────────────
const STORAGE_PATH = path.join(PATHS.root, '.storage-state.json');

async function loadStorageState(): Promise<string | undefined> {
  if (fs.existsSync(STORAGE_PATH)) {
    logger.debug(`ストレージ状態を読み込み: ${STORAGE_PATH}`);
    return STORAGE_PATH;
  }
  return undefined;
}

async function saveStorageState(ctx: BrowserContext): Promise<void> {
  try {
    await ctx.storageState({ path: STORAGE_PATH });
    logger.debug(`ストレージ状態を保存: ${STORAGE_PATH}`);
  } catch {
    // 保存失敗は無視
  }
}

// ──────────────────────────────────────────
// スクリーンショット保存ヘルパー
// ──────────────────────────────────────────
export async function screenshot(page: Page, label: string): Promise<void> {
  if (!BROWSER.screenshotOnStep) return;
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(PATHS.screenshots, `${ts}_${label}.png`);
    await page.screenshot({ path: filename, fullPage: false });
    logger.debug(`スクリーンショット保存: ${filename}`);
  } catch {
    // スクリーンショット失敗は無視
  }
}
