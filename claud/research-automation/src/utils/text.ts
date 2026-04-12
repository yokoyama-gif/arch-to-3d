// ============================================================
// utils/text.ts
// ============================================================

/** 長いテキストを安全にトリム */
export function truncate(text: string, maxLen = 200): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

/** 改行・空白の正規化 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** テキストに制限メッセージが含まれるか判定 */
export function containsLimitMessage(text: string, patterns: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some(p => lower.includes(p.toLowerCase()));
}

/** NotebookLM ソース用にテキストを整形（最大文字数を超えないよう分割） */
export function chunkText(text: string, maxChars = 200_000): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    // 段落境界で切る
    let end = offset + maxChars;
    if (end < text.length) {
      const newline = text.lastIndexOf('\n\n', end);
      if (newline > offset) end = newline;
    }
    chunks.push(text.slice(offset, end));
    offset = end;
  }
  return chunks;
}
