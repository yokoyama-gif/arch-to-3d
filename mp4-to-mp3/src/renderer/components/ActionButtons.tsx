import React from 'react';

interface Props {
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
  onOpenOutput: () => void;
  isConverting: boolean;
  hasJobs: boolean;
  pendingCount: number;
  completedCount: number;
}

export default function ActionButtons({
  onStart,
  onStop,
  onClear,
  onOpenOutput,
  isConverting,
  hasJobs,
  pendingCount,
  completedCount,
}: Props) {
  return (
    <div className="action-bar">
      <button
        className="btn btn-primary"
        onClick={onStart}
        disabled={isConverting || pendingCount === 0}
      >
        変換開始
      </button>
      <button
        className="btn btn-danger"
        onClick={onStop}
        disabled={!isConverting}
      >
        停止
      </button>
      <button
        className="btn btn-secondary"
        onClick={onClear}
        disabled={!hasJobs || isConverting}
      >
        クリア
      </button>
      <button
        className="btn btn-outline"
        onClick={onOpenOutput}
        disabled={completedCount === 0}
      >
        保存先を開く
      </button>
      <span className="action-bar-info">
        {hasJobs && (
          <>
            {pendingCount > 0 && `待機: ${pendingCount}件`}
            {pendingCount > 0 && completedCount > 0 && ' / '}
            {completedCount > 0 && `完了: ${completedCount}件`}
          </>
        )}
      </span>
    </div>
  );
}
