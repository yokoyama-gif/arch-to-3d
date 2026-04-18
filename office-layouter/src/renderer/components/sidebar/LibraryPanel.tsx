import { layoutTemplates } from '../../models/templates';
import { libraryItems } from '../../models/presets';
import { useProjectStore } from '../../store/projectStore';
import type { ZoneType } from '../../models/types';

const categoryLabels: Record<string, string> = {
  desk: '執務席',
  meeting: '会議',
  storage: '収納',
  support: 'サポート',
  reception: '受付',
  lounge: 'ラウンジ',
  structure: '構造',
};

const zoneAdders: Array<{ label: string; type: ZoneType; tone: string }> = [
  { label: '執務ゾーン', type: 'work', tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  { label: '会議ゾーン', type: 'meeting', tone: 'bg-violet-50 text-violet-700 border-violet-200' },
  { label: '受付ゾーン', type: 'reception', tone: 'bg-green-50 text-green-700 border-green-200' },
  { label: '共用ゾーン', type: 'support', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
];

export const LibraryPanel = () => {
  const project = useProjectStore((state) => state.project);
  const addObject = useProjectStore((state) => state.addObject);
  const addZone = useProjectStore((state) => state.addZone);
  const applyTemplate = useProjectStore((state) => state.applyTemplate);
  const deleteCustomLibraryItem = useProjectStore((state) => state.deleteCustomLibraryItem);

  const groupedPresets = libraryItems.reduce<Record<string, typeof libraryItems>>((acc, item) => {
    acc[item.category] ??= [];
    acc[item.category]!.push(item);
    return acc;
  }, {});

  const groupedCustom = project.customLibrary.reduce<Record<string, typeof project.customLibrary>>(
    (acc, item) => {
      acc[item.category] ??= [];
      acc[item.category]!.push(item);
      return acc;
    },
    {},
  );

  return (
    <aside className="flex h-full flex-col rounded-3xl bg-panel p-4 shadow-panel">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-ink">ライブラリとテンプレート</h2>
        <p className="mt-1 text-sm text-slate-500">
          テンプレート適用、ゾーン追加、プリセット家具、ユーザー定義ライブラリを扱います。
        </p>
      </div>

      <div className="space-y-5 overflow-auto pr-1">
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            テンプレート
          </h3>
          <div className="space-y-2">
            {layoutTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template.id)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-accent hover:bg-teal-50"
              >
                <div className="text-sm font-semibold text-ink">{template.name}</div>
                <div className="mt-1 text-xs text-slate-500">{template.description}</div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            ゾーン追加
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {zoneAdders.map((zone) => (
              <button
                key={zone.type}
                type="button"
                onClick={() => addZone(zone.type)}
                className={`rounded-2xl border px-3 py-3 text-left text-sm font-medium ${zone.tone}`}
              >
                {zone.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            プリセット家具
          </h3>
          <div className="space-y-4">
            {Object.entries(groupedPresets).map(([category, items]) => (
              <div key={category}>
                <div className="mb-2 text-xs font-semibold text-slate-400">
                  {categoryLabels[category] ?? category}
                </div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addObject(item.id)}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-accent hover:bg-teal-50"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-ink">{item.name}</span>
                        <span className="text-xs text-slate-500">
                          {item.width} x {item.height} / {item.seatCount}席
                        </span>
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        追加
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            ユーザー定義ライブラリ
          </h3>
          {project.customLibrary.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-slate-500">
              選択した家具を右側パネルからカスタム登録できます。
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedCustom).map(([category, items]) => (
                <div key={category}>
                  <div className="mb-2 text-xs font-semibold text-slate-400">
                    {categoryLabels[category] ?? category}
                  </div>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-200 bg-white p-3"
                      >
                        <button
                          type="button"
                          onClick={() => addObject(item.id)}
                          className="w-full text-left"
                        >
                          <div className="text-sm font-semibold text-ink">{item.name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {item.width} x {item.height} / {item.seatCount}席
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCustomLibraryItem(item.id)}
                          className="mt-3 rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-700"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
};
