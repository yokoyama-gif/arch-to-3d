// ============================================================
// utils/dedupe.ts — 重複防止
// ============================================================

import { ThemeState } from '../types.js';

/**
 * 同一 title のテーマが既に開始済みか確認する
 * pending 以外であれば「既存あり」と判定
 */
export function findExistingTheme(
  themes: ThemeState[],
  title: string,
): ThemeState | undefined {
  return themes.find(
    t => t.title === title && t.status !== 'pending',
  );
}

/** 重複チェック: id または title が一致するものを返す */
export function findDuplicate(
  themes: ThemeState[],
  id: string,
  title: string,
): ThemeState | undefined {
  return themes.find(t => t.id === id || t.title === title);
}
