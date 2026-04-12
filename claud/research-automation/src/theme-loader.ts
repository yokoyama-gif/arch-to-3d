// ============================================================
// theme-loader.ts — themes.json 読み込み・検証
// ============================================================

import fs from 'fs';
import { PATHS } from './config.js';
import { ThemeInput } from './types.js';
import { logger } from './logger.js';

export function loadThemes(): ThemeInput[] {
  if (!fs.existsSync(PATHS.themes)) {
    throw new Error(`themes.json が見つかりません: ${PATHS.themes}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(PATHS.themes, 'utf8'));
  } catch (err) {
    throw new Error(`themes.json の JSON パースに失敗: ${err}`);
  }

  if (!Array.isArray(raw)) {
    throw new Error('themes.json は配列形式で記述してください');
  }

  const validated: ThemeInput[] = [];
  for (const item of raw) {
    if (
      typeof item !== 'object' ||
      typeof item.id !== 'string' ||
      typeof item.title !== 'string' ||
      typeof item.prompt !== 'string'
    ) {
      logger.warn('不正なテーマエントリをスキップ', { item });
      continue;
    }
    validated.push({ id: item.id, title: item.title, prompt: item.prompt });
  }

  logger.info(`themes.json 読み込み完了: ${validated.length} 件`);
  return validated;
}
