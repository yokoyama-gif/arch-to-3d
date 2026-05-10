import React from 'react';

interface MenuItem {
  label: string;
  action?: string;     // App 側で識別するキー
  hint?: string;       // 右側の補助表示
  disabled?: boolean;
}
interface MenuGroup { label: string; items: MenuItem[] }

const MENU_GROUPS: MenuGroup[] = [
  { label: 'ファイル(F)', items: [
    { label: '新規',                 action: 'file.new',     hint: 'Ctrl+N' },
    { label: '開く...',              action: 'file.open',    hint: 'Ctrl+O' },
    { label: '保存 (JSON)',          action: 'file.save',    hint: 'Ctrl+S' },
    { label: '名前を付けて保存...',   action: 'file.saveAs',  hint: 'Ctrl+Shift+S' },
    { label: 'PDF出力 (A3 横)',      action: 'file.exportPDF' },
    { label: 'DXF出力',              action: 'file.exportDXF' },
  ]},
  { label: '編集(E)', items: [
    { label: '元に戻す',  action: 'edit.undo', hint: 'Ctrl+Z' },
    { label: 'やり直し',  action: 'edit.redo', hint: 'Ctrl+Y / Ctrl+Shift+Z' },
    { label: '削除',      action: 'edit.deleteSelected', hint: 'Del' },
  ]},
  { label: '表示(V)', items: [
    { label: '全体表示',         action: 'view.fitAll',         hint: 'F' },
    { label: 'ズームイン',       action: 'view.zoomIn',         hint: '+' },
    { label: 'ズームアウト',     action: 'view.zoomOut',        hint: '-' },
    { label: '初期表示に戻す',   action: 'view.reset',          hint: '0' },
    { label: '自動寸法 表示切替', action: 'view.toggleAutoDims', hint: 'T' },
  ]},
  { label: '作図(D)', items: [
    { label: '敷地線', action: 'tool.siteLine', hint: 'L' },
    { label: '道路',   action: 'tool.road',     hint: 'R' },
    { label: '建物',   action: 'tool.building', hint: 'B' },
    { label: '寸法線', action: 'tool.dimension',hint: 'D' },
    { label: '方位',   action: 'tool.compass',  hint: 'N' },
  ]},
  { label: '計算(C)', items: [
    { label: '敷地面積',          hint: '右パネルに表示中' },
    { label: '建ぺい率',          hint: '右パネルに表示中' },
    { label: '自動寸法を実体化',  action: 'calc.materializeAutoDims', hint: '編集可能に' },
    { label: '容積率',            hint: '準備中', disabled: true },
    { label: '旗竿地判定',        hint: '準備中', disabled: true },
  ]},
  { label: 'ヘルプ(H)', items: [
    { label: '操作ガイド',  hint: '上部黄色帯参照' },
    { label: 'バージョン情報', action: 'help.about' },
  ]},
];

interface Props {
  onAction?: (action: string) => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const TopMenu: React.FC<Props> = ({ onAction, canUndo = false, canRedo = false }) => {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  // 動的な disable 判定（履歴状態などで変わる項目）
  const isDynamicallyDisabled = (item: MenuItem): boolean => {
    if (item.action === 'edit.undo' && !canUndo) return true;
    if (item.action === 'edit.redo' && !canRedo) return true;
    return false;
  };

  const handleClick = (item: MenuItem) => {
    setOpenIndex(null);
    if (item.disabled || isDynamicallyDisabled(item) || !item.action) return;
    onAction?.(item.action);
  };

  return (
    <div className="topmenu" role="menubar">
      <div className="topmenu-title">配置図CAD</div>
      <div className="topmenu-groups">
        {MENU_GROUPS.map((g, i) => (
          <div
            key={g.label}
            className={'topmenu-group' + (openIndex === i ? ' is-open' : '')}
            onMouseEnter={() => openIndex !== null && setOpenIndex(i)}
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
          >
            <span className="topmenu-label">{g.label}</span>
            {openIndex === i && (
              <ul
                className="topmenu-dropdown"
                onMouseLeave={() => setOpenIndex(null)}
                onClick={e => e.stopPropagation()}
              >
                {g.items.map(it => {
                  const dyn = isDynamicallyDisabled(it);
                  const cls = 'topmenu-item' + ((it.disabled || dyn) ? ' is-disabled' : '');
                  return (
                    <li
                      key={it.label}
                      className={cls}
                      onClick={() => handleClick(it)}
                    >
                      <span>{it.label}</span>
                      {it.hint && <span className="topmenu-item-hint">{it.hint}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
      <div className="topmenu-right">Phase 6+9+10</div>
    </div>
  );
};
