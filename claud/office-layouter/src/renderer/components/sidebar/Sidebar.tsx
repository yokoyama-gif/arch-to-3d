import React from "react";
import { LIBRARY } from "../../models/presets";
import { useProjectStore } from "../../store/projectStore";

const CATEGORY_LABELS: Record<string, string> = {
  desk: "机",
  meeting: "会議",
  storage: "収納",
  service: "サービス",
  lounge: "ラウンジ",
  structure: "構造物",
};

export const Sidebar: React.FC = () => {
  const addObjectFromKind = useProjectStore((s) => s.addObjectFromKind);

  const grouped = LIBRARY.reduce<Record<string, typeof LIBRARY>>((acc, item) => {
    (acc[item.category] ||= []).push(item);
    return acc;
  }, {});

  return (
    <aside className="w-56 shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
      <div className="p-3 text-sm font-semibold border-b border-slate-200">家具・什器</div>
      <div className="p-2 space-y-3">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <div className="text-xs font-semibold text-slate-500 px-1 mb-1">
              {CATEGORY_LABELS[cat] ?? cat}
            </div>
            <div className="space-y-1">
              {items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => addObjectFromKind(it.kind)}
                  className="w-full text-left px-2 py-1.5 text-sm rounded border border-slate-200 hover:border-blue-400 hover:bg-blue-50"
                  title={`${it.defaultWidth}×${it.defaultHeight}mm`}
                >
                  <div className="font-medium">{it.label}</div>
                  <div className="text-[10px] text-slate-500">
                    {it.defaultWidth}×{it.defaultHeight}mm
                    {it.seats ? ` / ${it.seats}席` : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};
