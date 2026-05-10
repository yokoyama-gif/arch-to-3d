import React from 'react';
import type { InputState, Point, ToolId } from '../types/drawing';
import { TOOL_DEFINITIONS } from './ToolBar';

interface Props {
  tool: ToolId;
  inputState: InputState;
  cursorMM?: Point | null;
  statusMsg?: string;
}

interface GuideText {
  step: string;
  hint: string;
}

function buildGuide(tool: ToolId, input: InputState): GuideText {
  // 入力進行中はそちらを優先
  switch (input.kind) {
    case 'site-drawing': {
      const n = input.points.length;
      if (n === 0) return {
        step: '敷地の最初の頂点をクリックしてください',
        hint: 'グリッド1mに自動スナップ / ESC: 取消',
      };
      if (n < 3) return {
        step: `次の頂点をクリック（${n}点入力済）`,
        hint: 'ESC: 取消',
      };
      return {
        step: `次の頂点をクリック または 始点付近で確定（${n}点入力済）`,
        hint: 'Enter / 右クリック: 確定 / ESC: 取消',
      };
    }
    case 'building-corner1':
      return {
        step: '建物矩形の1点目（基点）をクリック',
        hint: 'グリッド1mに自動スナップ / ESC: 取消',
      };
    case 'building-corner2':
      return {
        step: `建物矩形の対角点をクリック（基点 X=${Math.round(input.first.x)}, Y=${Math.round(input.first.y)}）`,
        hint: '右クリック: 1点目に戻る / ESC: 取消',
      };
    case 'road-point1':
      return {
        step: '道路中心線の始点をクリック（幅員 4000mm）',
        hint: 'グリッド1mに自動スナップ / ESC: 取消',
      };
    case 'road-point2':
      return {
        step: `道路中心線の終点をクリック（始点 X=${Math.round(input.first.x)}, Y=${Math.round(input.first.y)}）`,
        hint: '右クリック: 1点目に戻る / ESC: 取消',
      };
    case 'dimension-point1':
      return {
        step: '寸法を測る1点目をクリック',
        hint: 'グリッド1mに自動スナップ / ESC: 取消',
      };
    case 'dimension-point2':
      return {
        step: `寸法を測る2点目をクリック（1点目 X=${Math.round(input.first.x)}, Y=${Math.round(input.first.y)}）`,
        hint: 'オフセット 1500mm / 右クリック: 1点目に戻る / ESC: 取消',
      };
    case 'compass-place':
      return {
        step: '方位記号を配置する位置をクリック（連続配置可）',
        hint: 'ESC: 取消',
      };
    case 'idle':
      break;
  }
  // ツール既定ガイド
  const def = TOOL_DEFINITIONS.find(t => t.id === tool);
  return {
    step: def?.guide ?? 'ツールを選択してください。',
    hint: tool === 'select'
      ? '図形クリックで選択 / ドラッグで移動 / Delete で削除'
      : tool === 'delete'
        ? 'クリックした図形を削除します。慎重に。'
        : 'ESC: 選択ツールに戻る',
  };
}

export const CommandGuide: React.FC<Props> = ({ tool, inputState, cursorMM, statusMsg }) => {
  const def = TOOL_DEFINITIONS.find(t => t.id === tool);
  const { step, hint } = buildGuide(tool, inputState);

  return (
    <div className="commandguide">
      <span className="cg-tag">コマンド</span>
      <span className="cg-tool">[{def?.label ?? '-'}]</span>
      <span className="cg-arrow">›</span>
      <span className="cg-text">{step}</span>
      {cursorMM && (tool !== 'select' && tool !== 'delete') && (
        <span className="cg-coord">
          @ X={Math.round(cursorMM.x)}, Y={Math.round(cursorMM.y)} mm
        </span>
      )}
      <span className="cg-hint">{hint}</span>
      {statusMsg && <span className="cg-status">{statusMsg}</span>}
    </div>
  );
};
