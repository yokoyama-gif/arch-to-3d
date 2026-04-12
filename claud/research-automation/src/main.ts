// ============================================================
// main.ts — メインオーケストレーター
// ============================================================

import { loadThemes } from './theme-loader.js';
import {
  loadState,
  saveState,
  upsertTheme,
  makeThemeState,
  setStatus,
  updateTheme,
  countRunningDeepResearch,
  pendingThemes,
  allCompleted,
  releaseCooldowns,
} from './state-manager.js';
import { logger } from './logger.js';
import { CONCURRENCY } from './config.js';
import { AppState, LimitReachedError, ThemeState } from './types.js';
import { newPage, closeBrowser } from './browser/launch.js';
import { findDuplicate } from './utils/dedupe.js';
import { sleep } from './utils/sleep.js';
import { nowIso } from './utils/time.js';
import { handleLimitReached, waitForAnyCooldown } from './scheduler.js';

// ── ワークフロー ──
import { createDeepResearch } from './workflows/deepresearch-create.js';
import { waitForDeepResearch } from './workflows/deepresearch-monitor.js';
import { exportDeepResearchContent } from './workflows/deepresearch-export.js';
import { createNotebook } from './workflows/notebooklm-create.js';
import { addTextSource } from './workflows/notebooklm-add-text-source.js';
import { createSlide } from './workflows/slide-create.js';

// ============================================================
// エントリポイント
// ============================================================
async function main(): Promise<void> {
  logger.info('=== Research Automation 開始 ===');

  // ──────────────────────────────────────────
  // 1. テーマ読み込み・状態初期化
  // ──────────────────────────────────────────
  const themes = loadThemes();
  const state = loadState();

  // 新規テーマを state に追加（重複スキップ）
  for (const theme of themes) {
    const dup = findDuplicate(state.themes, theme.id, theme.title);
    if (dup) {
      logger.debug(`重複スキップ: ${theme.id} (${theme.title})`);
      continue;
    }
    upsertTheme(state, makeThemeState(theme));
  }
  saveState(state);

  logger.info(`対象テーマ数: ${state.themes.length}`);

  // ──────────────────────────────────────────
  // 2. メインループ
  // ──────────────────────────────────────────
  while (!allCompleted(state)) {
    // クールダウン解除チェック
    releaseCooldowns(state);

    // 実行中件数を確認
    const runningCount = countRunningDeepResearch(state);
    const canStart = CONCURRENCY.maxDeepResearch - runningCount;

    // ──────────────────────────────────────────
    // A. 新規 Deep Research 開始
    // ──────────────────────────────────────────
    if (canStart > 0) {
      const pending = pendingThemes(state).slice(0, canStart);
      for (const theme of pending) {
        // 非同期で起動（待たずに次を投入）
        startDeepResearchPipeline(state, theme).catch(err => {
          logger.themeError(theme.id, 'PIPELINE', `未捕捉エラー: ${err}`);
        });
        // 少し待ってから次を投入（ブラウザ競合を緩和）
        await sleep(3_000);
      }
    }

    // ──────────────────────────────────────────
    // B. 完了待ち・処理可能テーマの後続ステップ
    // ──────────────────────────────────────────
    const postDRThemes = state.themes.filter(
      t => t.status === 'deepresearch_completed',
    );
    for (const theme of postDRThemes) {
      postDeepResearchPipeline(state, theme).catch(err => {
        logger.themeError(theme.id, 'POST_PIPELINE', `未捕捉エラー: ${err}`);
      });
      await sleep(2_000);
    }

    // ──────────────────────────────────────────
    // C. 処理可能テーマが存在しない場合の待機
    // ──────────────────────────────────────────
    const actionableCount = pendingThemes(state).length +
      countRunningDeepResearch(state) +
      state.themes.filter(t => t.status === 'deepresearch_completed').length;

    if (actionableCount === 0) {
      logger.info('処理可能テーマなし → クールダウン解除待ち...');
      await waitForAnyCooldown(state);
    } else {
      await sleep(CONCURRENCY.mainLoopIntervalMs);
    }

    // 進捗サマリ出力
    printProgress(state);
  }

  logger.success('=== 全テーマ処理完了 ===');
  await closeBrowser();
}

// ============================================================
// Deep Research 開始 → 完了待ち → テキスト取得
// ============================================================
async function startDeepResearchPipeline(
  state: AppState,
  theme: ThemeState,
): Promise<void> {
  const page = await newPage();
  try {
    setStatus(state, theme.id, 'deepresearch_running', { startedAt: nowIso() });

    // ── 作成 ──
    const { jobId } = await createDeepResearch(page, theme.id, theme.prompt);
    updateTheme(state, theme.id, {
      deepresearchJobId: jobId,
      deepresearchStatus: 'running',
    });

    // ── 完了待ち ──
    await waitForDeepResearch(page, theme.id, jobId);
    updateTheme(state, theme.id, { deepresearchStatus: 'completed' });

    // ── テキスト取得 ──
    const content = await exportDeepResearchContent(page, theme.id);
    setStatus(state, theme.id, 'deepresearch_completed', {
      deepresearchContent: content,
    });

    logger.theme(theme.id, 'DR_PIPELINE', '完了');
  } catch (err) {
    if (err instanceof LimitReachedError) {
      handleLimitReached(state, state.themes.find(t => t.id === theme.id)!, err);
    } else {
      const msg = String(err);
      updateTheme(state, theme.id, {
        status: 'error',
        deepresearchStatus: 'failed',
        lastError: msg,
      });
      logger.themeError(theme.id, 'DR_PIPELINE', msg);
    }
  } finally {
    await page.close();
  }
}

// ============================================================
// Deep Research 完了後: NotebookLM 作成 → ソース追加 → スライド
// ============================================================
async function postDeepResearchPipeline(
  state: AppState,
  theme: ThemeState,
): Promise<void> {
  const page = await newPage();
  try {
    const current = state.themes.find(t => t.id === theme.id)!;

    // ── NotebookLM 作成 ──
    if (current.notebooklmStatus === 'pending') {
      const { projectId } = await createNotebook(page, theme.id, theme.title);
      setStatus(state, theme.id, 'notebooklm_created', {
        notebooklmProjectId: projectId,
        notebooklmStatus: 'created',
      });
    }

    // ── ソース追加 ──
    const refreshed = state.themes.find(t => t.id === theme.id)!;
    if (
      refreshed.notebooklmStatus === 'created' &&
      refreshed.deepresearchContent &&
      refreshed.notebooklmProjectId
    ) {
      await addTextSource(
        page,
        theme.id,
        refreshed.notebooklmProjectId,
        refreshed.deepresearchContent,
        refreshed.title,
      );
      setStatus(state, theme.id, 'source_added', {
        notebooklmStatus: 'source_added',
      });
    }

    // ── スライド作成 ──
    const forSlide = state.themes.find(t => t.id === theme.id)!;
    if (
      forSlide.status === 'source_added' &&
      forSlide.notebooklmProjectId
    ) {
      const { slideUrl } = await createSlide(page, theme.id, forSlide.notebooklmProjectId);
      setStatus(state, theme.id, 'completed', {
        slideStatus: 'created',
        slideUrl,
        completedAt: nowIso(),
      });
    }

    logger.success(`[${theme.id}] 全工程完了`);
  } catch (err) {
    if (err instanceof LimitReachedError) {
      handleLimitReached(state, state.themes.find(t => t.id === theme.id)!, err);
    } else {
      const msg = String(err);
      updateTheme(state, theme.id, {
        status: 'error',
        lastError: msg,
      });
      logger.themeError(theme.id, 'POST_PIPELINE', msg);
    }
  } finally {
    await page.close();
  }
}

// ============================================================
// 進捗サマリ
// ============================================================
function printProgress(state: AppState): void {
  const counts: Record<string, number> = {};
  for (const t of state.themes) {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  }
  const summary = Object.entries(counts)
    .map(([k, v]) => `${k}:${v}`)
    .join(' | ');
  logger.info(`進捗 → ${summary}`);
}

// ============================================================
// 起動
// ============================================================
main().catch(err => {
  logger.error(`致命的エラー: ${err}`);
  process.exit(1);
});
