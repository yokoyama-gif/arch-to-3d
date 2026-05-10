import React from 'react';
import type { Point, ToolId } from '../types/drawing';
import { TOOL_DEFINITIONS } from './ToolBar';

interface Props {
  tool: ToolId;
  cursorMM: Point | null;
  scaleDenominator: number;
  shapeCount?: number;
  message?: string;
  historyIndex?: number;
  historySize?: number;
}

export const StatusBar: React.FC<Props> = ({
  tool, cursorMM, scaleDenominator, shapeCount, message, historyIndex, historySize,
}) => {
  const def = TOOL_DEFINITIONS.find(t => t.id === tool);
  return (
    <div className="statusbar">
      <div className="statusbar-cell statusbar-tool">
        <span className="sb-key">ツール</span>
        <span className="sb-val">{def?.label ?? '-'}</span>
      </div>
      <div className="statusbar-cell">
        <span className="sb-key">座標(mm)</span>
        <span className="sb-val">
          {cursorMM
            ? `X = ${Math.round(cursorMM.x)},  Y = ${Math.round(cursorMM.y)}`
            : '— (キャンバス外)'}
        </span>
      </div>
      <div className="statusbar-cell">
        <span className="sb-key">縮尺</span>
        <span className="sb-val">1 / {scaleDenominator}</span>
      </div>
      <div className="statusbar-cell">
        <span className="sb-key">単位</span>
        <span className="sb-val">mm</span>
      </div>
      <div className="statusbar-cell">
        <span className="sb-key">グリッド</span>
        <span className="sb-val">細 1m / 太 5m / スナップ 1m</span>
      </div>
      {typeof shapeCount === 'number' && (
        <div className="statusbar-cell">
          <span className="sb-key">図形</span>
          <span className="sb-val">{shapeCount}</span>
        </div>
      )}
      <div className="statusbar-cell statusbar-spacer" />
      {message && (
        <div className="statusbar-cell statusbar-message">
          <span className="sb-val">{message}</span>
        </div>
      )}
      {typeof historyIndex === 'number' && typeof historySize === 'number' && (
        <div className="statusbar-cell">
          <span className="sb-key">履歴</span>
          <span className="sb-val">{historyIndex + 1}/{historySize}</span>
        </div>
      )}
      <div className="statusbar-cell statusbar-mode">
        <span className="sb-key">モード</span>
        <span className="sb-val">編集（Phase 7-8）</span>
      </div>
    </div>
  );
};
