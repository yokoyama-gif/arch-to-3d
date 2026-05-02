import React from 'react';

export type RouteKey = 'dashboard' | 'entry' | 'history' | 'import';

const ITEMS: { key: RouteKey; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'ダッシュボード', icon: '◆' },
  { key: 'entry', label: '稼働を記録', icon: '＋' },
  { key: 'history', label: '履歴', icon: '☰' },
  { key: 'import', label: 'インポート', icon: '↥' },
];

export function Sidebar({
  current,
  onChange,
}: {
  current: RouteKey;
  onChange: (k: RouteKey) => void;
}) {
  return (
    <aside className="w-[200px] shrink-0 border-r border-border bg-panel flex flex-col">
      <div className="px-5 py-5 border-b border-border">
        <div className="text-accent text-lg font-bold tracking-wide">Uber Eats</div>
        <div className="text-xs text-muted mt-0.5">稼働分析ツール</div>
      </div>
      <nav className="flex-1 p-2">
        {ITEMS.map((it) => {
          const active = current === it.key;
          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 flex items-center gap-3 transition
                ${active ? 'bg-accent text-app font-semibold' : 'text-ink hover:bg-panel2'}`}
            >
              <span className="text-base w-5 text-center">{it.icon}</span>
              <span className="text-sm">{it.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="p-3 text-[10px] text-muted border-t border-border">
        v0.1.0 · ローカル保存 (SQLite)
      </div>
    </aside>
  );
}
