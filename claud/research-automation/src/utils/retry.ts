// ============================================================
// utils/retry.ts
// ============================================================

import { sleep } from './sleep.js';
import { logger } from '../logger.js';
import { RETRY } from '../config.js';
import { LimitReachedError } from '../types.js';

interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  label?: string;
  /** LimitReachedError は即リスロー（リトライしない） */
  rethrowLimit?: boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = RETRY.maxAttempts,
    delayMs = RETRY.defaultDelayMs,
    label = 'operation',
    rethrowLimit = true,
  } = opts;

  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (err) {
      if (rethrowLimit && err instanceof LimitReachedError) throw err;

      if (attempt >= maxAttempts) {
        logger.error(`[retry] ${label} failed after ${attempt} attempts`, {
          error: String(err),
        });
        throw err;
      }

      const wait = delayMs * Math.pow(2, attempt - 1); // 指数バックオフ
      logger.warn(`[retry] ${label} attempt ${attempt}/${maxAttempts} failed, retry in ${wait}ms`, {
        error: String(err),
      });
      await sleep(wait);
    }
  }
}
