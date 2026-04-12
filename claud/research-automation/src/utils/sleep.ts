// ============================================================
// utils/sleep.ts
// ============================================================

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 指定ISO文字列の時刻まで待機 */
export async function sleepUntil(isoString: string, onWait?: (remainMs: number) => void): Promise<void> {
  const target = new Date(isoString).getTime();
  const loop = async () => {
    const remain = target - Date.now();
    if (remain <= 0) return;
    onWait?.(remain);
    await sleep(Math.min(remain, 60_000)); // 最大1分刻みでチェック
    await loop();
  };
  await loop();
}
