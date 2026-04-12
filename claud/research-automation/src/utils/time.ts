// ============================================================
// utils/time.ts
// ============================================================

/** ISO文字列を返す */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * 画面テキストから制限解除時刻を推定する
 * 例: "1時間後", "明日", "23:00", "at 5:00 PM" など
 * 読み取れなければ null を返す
 */
export function parseResetTime(text: string): string | null {
  const now = Date.now();

  // "N時間後"
  const hoursMatch = text.match(/(\d+)\s*時間後/);
  if (hoursMatch) {
    return new Date(now + parseInt(hoursMatch[1]) * 3600_000).toISOString();
  }

  // "N hours"
  const hoursEnMatch = text.match(/(\d+)\s*hour/i);
  if (hoursEnMatch) {
    return new Date(now + parseInt(hoursEnMatch[1]) * 3600_000).toISOString();
  }

  // "N分後"
  const minsMatch = text.match(/(\d+)\s*分後/);
  if (minsMatch) {
    return new Date(now + parseInt(minsMatch[1]) * 60_000).toISOString();
  }

  // "N minutes"
  const minsEnMatch = text.match(/(\d+)\s*minute/i);
  if (minsEnMatch) {
    return new Date(now + parseInt(minsEnMatch[1]) * 60_000).toISOString();
  }

  // "明日" or "tomorrow"
  if (/明日|tomorrow/i.test(text)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }

  // "HH:MM" 形式（今日か翌日か判定）
  const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const candidate = new Date();
    candidate.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
    if (candidate.getTime() <= now) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate.toISOString();
  }

  return null;
}

export function msUntil(isoString: string): number {
  return Math.max(0, new Date(isoString).getTime() - Date.now());
}

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}
