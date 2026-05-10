import React from 'react';

// 汎用 Undo/Redo フック。値のスナップショットをスタックに積む単純な実装。
// ・set(updater) は新しい値を push して index を進める
// ・undo / redo は index を移動するだけで、stack は変更しない
// ・replace(value) は履歴を完全に置き換える（ファイル新規/読込で使用）
// ・MAX_DEPTH を超えたら古い側を切り詰める
// ・updater が同一参照を返した場合は履歴を増やさない（no-op fast path）

interface HistoryState<T> {
  stack: T[];
  index: number;
}

const MAX_DEPTH = 100;

export interface UseHistoryResult<T> {
  value: T;
  set: (updater: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  replace: (value: T) => void;
  canUndo: boolean;
  canRedo: boolean;
  historySize: number;
  historyIndex: number;
}

export function useHistory<T>(initial: T): UseHistoryResult<T> {
  const [hist, setHist] = React.useState<HistoryState<T>>({
    stack: [initial],
    index: 0,
  });

  const value = hist.stack[hist.index];

  const set = React.useCallback((updater: T | ((prev: T) => T)) => {
    setHist(h => {
      const prev = h.stack[h.index];
      const next = typeof updater === 'function'
        ? (updater as (p: T) => T)(prev)
        : updater;
      if (next === prev) return h;
      // 現在 index より先（redo 範囲）を捨てて、新しい状態を push
      const newStack = h.stack.slice(0, h.index + 1);
      newStack.push(next);
      if (newStack.length > MAX_DEPTH) {
        const trimmed = newStack.slice(newStack.length - MAX_DEPTH);
        return { stack: trimmed, index: trimmed.length - 1 };
      }
      return { stack: newStack, index: newStack.length - 1 };
    });
  }, []);

  const undo = React.useCallback(() => {
    setHist(h => (h.index > 0 ? { ...h, index: h.index - 1 } : h));
  }, []);

  const redo = React.useCallback(() => {
    setHist(h => (h.index < h.stack.length - 1 ? { ...h, index: h.index + 1 } : h));
  }, []);

  const replace = React.useCallback((v: T) => {
    setHist({ stack: [v], index: 0 });
  }, []);

  return {
    value,
    set,
    undo,
    redo,
    replace,
    canUndo: hist.index > 0,
    canRedo: hist.index < hist.stack.length - 1,
    historySize: hist.stack.length,
    historyIndex: hist.index,
  };
}
