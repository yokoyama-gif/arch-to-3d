import React from 'react';
import type { ToolDefinition, ToolId } from '../types/drawing';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: 'select',
    label: '選択',
    shortcut: 'S',
    guide: '図形をクリックして選択します。ドラッグで範囲選択（将来対応）。',
    cursor: 'default',
  },
  {
    id: 'siteLine',
    label: '敷地線',
    shortcut: 'L',
    guide: '敷地の頂点を順にクリックします。Enter または右クリックで閉じます。',
    cursor: 'crosshair',
  },
  {
    id: 'road',
    label: '道路',
    shortcut: 'R',
    guide: '道路中心線の始点と終点をクリック後、幅員を入力します。',
    cursor: 'crosshair',
  },
  {
    id: 'building',
    label: '建物',
    shortcut: 'B',
    guide: '建物矩形の対角2点をクリックして配置します。',
    cursor: 'crosshair',
  },
  {
    id: 'dimension',
    label: '寸法',
    shortcut: 'D',
    guide: '寸法を測る2点をクリックし、寸法線位置を指定します。',
    cursor: 'crosshair',
  },
  {
    id: 'compass',
    label: '方位',
    shortcut: 'N',
    guide: '方位記号の中心位置をクリックします。',
    cursor: 'crosshair',
  },
  {
    id: 'delete',
    label: '削除',
    shortcut: 'Del',
    guide: '削除する図形をクリックします。',
    cursor: 'not-allowed',
  },
];

// アイコンは SVG で簡易実装。CAD らしい線画。
const Icon: React.FC<{ id: ToolId }> = ({ id }) => {
  const stroke = 'currentColor';
  const sw = 1.6;
  switch (id) {
    case 'select':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
          <path d="M5 3 L5 19 L9 15 L12 21 L14 20 L11 14 L17 14 Z" />
        </svg>
      );
    case 'siteLine':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
          <path d="M3 19 L9 5 L20 8 L17 20 Z" />
          <circle cx="3" cy="19" r="1.4" fill={stroke} />
          <circle cx="9" cy="5"  r="1.4" fill={stroke} />
          <circle cx="20" cy="8" r="1.4" fill={stroke} />
          <circle cx="17" cy="20" r="1.4" fill={stroke} />
        </svg>
      );
    case 'road':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
          <path d="M4 4 L4 20" />
          <path d="M20 4 L20 20" />
          <path d="M12 4 L12 8" strokeDasharray="2 2" />
          <path d="M12 12 L12 16" strokeDasharray="2 2" />
        </svg>
      );
    case 'building':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
          <rect x="4" y="6" width="16" height="13" />
          <path d="M4 6 L12 2 L20 6" />
          <rect x="10" y="13" width="4" height="6" />
        </svg>
      );
    case 'dimension':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
          <path d="M4 16 L20 16" />
          <path d="M4 13 L4 19" />
          <path d="M20 13 L20 19" />
          <path d="M7 16 L4 16 M17 16 L20 16" />
          <text x="12" y="11" fontSize="6" textAnchor="middle" fill={stroke} stroke="none">寸</text>
        </svg>
      );
    case 'compass':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4 L14 12 L12 20 L10 12 Z" fill={stroke} />
          <text x="12" y="3.5" fontSize="4" textAnchor="middle" fill={stroke} stroke="none">N</text>
        </svg>
      );
    case 'delete':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
          <path d="M5 7 L19 7" />
          <path d="M9 7 L9 4 L15 4 L15 7" />
          <path d="M7 7 L8 20 L16 20 L17 7" />
          <path d="M11 11 L11 17 M13 11 L13 17" />
        </svg>
      );
  }
};

interface Props {
  current: ToolId;
  onChange: (id: ToolId) => void;
}

export const ToolBar: React.FC<Props> = ({ current, onChange }) => {
  return (
    <div className="toolbar" role="toolbar" aria-label="作図ツール">
      <div className="toolbar-section-title">ツール</div>
      {TOOL_DEFINITIONS.map(t => (
        <button
          key={t.id}
          type="button"
          className={'toolbar-btn' + (current === t.id ? ' is-active' : '')}
          onClick={() => onChange(t.id)}
          title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ''}\n${t.guide}`}
        >
          <span className="toolbar-icon"><Icon id={t.id} /></span>
          <span className="toolbar-label">{t.label}</span>
          {t.shortcut && <span className="toolbar-shortcut">{t.shortcut}</span>}
        </button>
      ))}
    </div>
  );
};
