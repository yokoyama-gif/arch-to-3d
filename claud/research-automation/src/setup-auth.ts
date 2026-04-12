// ============================================================
// setup-auth.ts — Google ログイン用セットアップ（初回のみ）
// PowerShell / CMD から手動で実行すること
// ============================================================

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STORAGE_PATH = path.join(ROOT, '.storage-state.json');

async function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

async function main() {
  console.log('=== Google ログインセットアップ ===');
  console.log('ブラウザが開きます。Gemini と NotebookLM に Google ログインしてください。');
  console.log('');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });

  // Gemini へ移動してログインを促す
  const page = await context.newPage();
  await page.goto('https://accounts.google.com/');
  console.log('');
  console.log('>>> ブラウザで Google にログインし、完了したら Enter を押してください...');

  await waitForEnter('Enterキーを押して続行: ');

  // NotebookLM も確認
  await page.goto('https://notebooklm.google.com/');
  console.log('>>> NotebookLM が正しく表示されたら Enter を押してください...');
  await waitForEnter('Enterキーを押して続行: ');

  // ストレージ状態を保存
  await context.storageState({ path: STORAGE_PATH });
  console.log(`\nログイン状態を保存しました: ${STORAGE_PATH}`);

  await browser.close();
  console.log('\nセットアップ完了！ 次に npm run dev で自動化を開始してください。');
}

main().catch(err => {
  console.error('エラー:', err);
  process.exit(1);
});
