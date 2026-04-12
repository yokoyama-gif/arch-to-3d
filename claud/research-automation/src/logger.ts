// ============================================================
// logger.ts — 日付付きログファイル出力
// ============================================================

import fs from 'fs';
import path from 'path';
import { PATHS } from './config.js';

type Level = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SUCCESS';

function getLogFilePath(): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(PATHS.logs, `${date}.log`);
}

function formatLine(level: Level, message: string, context?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const ctx = context ? ` | ${JSON.stringify(context)}` : '';
  return `[${ts}] [${level.padEnd(7)}] ${message}${ctx}`;
}

function write(level: Level, message: string, context?: Record<string, unknown>): void {
  const line = formatLine(level, message, context);

  // コンソール出力（色付き）
  const colors: Record<Level, string> = {
    INFO:    '\x1b[36m',   // cyan
    WARN:    '\x1b[33m',   // yellow
    ERROR:   '\x1b[31m',   // red
    DEBUG:   '\x1b[90m',   // gray
    SUCCESS: '\x1b[32m',   // green
  };
  console.log(`${colors[level]}${line}\x1b[0m`);

  // ファイル書き込み
  try {
    fs.mkdirSync(PATHS.logs, { recursive: true });
    fs.appendFileSync(getLogFilePath(), line + '\n', 'utf8');
  } catch {
    // ログ失敗は握りつぶす（ログのために止まらない）
  }
}

export const logger = {
  info:    (msg: string, ctx?: Record<string, unknown>) => write('INFO',    msg, ctx),
  warn:    (msg: string, ctx?: Record<string, unknown>) => write('WARN',    msg, ctx),
  error:   (msg: string, ctx?: Record<string, unknown>) => write('ERROR',   msg, ctx),
  debug:   (msg: string, ctx?: Record<string, unknown>) => write('DEBUG',   msg, ctx),
  success: (msg: string, ctx?: Record<string, unknown>) => write('SUCCESS', msg, ctx),

  /** テーマ処理に特化した出力（どのテーマがどこで何をしたか一目でわかる） */
  theme: (themeId: string, step: string, msg: string, ctx?: Record<string, unknown>) =>
    write('INFO', `[${themeId}] [${step}] ${msg}`, ctx),

  themeError: (themeId: string, step: string, msg: string, ctx?: Record<string, unknown>) =>
    write('ERROR', `[${themeId}] [${step}] ${msg}`, ctx),
};
