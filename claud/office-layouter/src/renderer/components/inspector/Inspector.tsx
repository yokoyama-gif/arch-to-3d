import React from "react";
import { useProjectStore } from "../../store/projectStore";

export const Inspector: React.FC = () => {
  const project = useProjectStore((s) => s.project);
  const selectedId = useProjectStore((s) => s.selectedObjectId);
  const updateObject = useProjectStore((s) => s.updateObject);
  const rotateObject = useProjectStore((s) => s.rotateObject);
  const deleteObject = useProjectStore((s) => s.deleteObject);
  const setRoomSize = useProjectStore((s) => s.setRoomSize);
  const setSettings = useProjectStore((s) => s.setSettings);
  const activePlanId = project.activePlanId;
  const activePlan = project.plans.find((p) => p.id === activePlanId)!;
  const obj = activePlan.objects.find((o) => o.id === selectedId) ?? null;

  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
      <div className="p-3 text-sm font-semibold border-b border-slate-200">設定</div>

      <section className="p-3 border-b border-slate-200 space-y-2">
        <div className="text-xs font-semibold text-slate-500">部屋</div>
        <label className="block text-xs">
          幅 (mm)
          <input
            type="number"
            className="mt-0.5 w-full border rounded px-2 py-1 text-sm"
            value={activePlan.room.width}
            min={1000}
            step={100}
            onChange={(e) => setRoomSize(Number(e.target.value), activePlan.room.height)}
          />
        </label>
        <label className="block text-xs">
          奥行 (mm)
          <input
            type="number"
            className="mt-0.5 w-full border rounded px-2 py-1 text-sm"
            value={activePlan.room.height}
            min={1000}
            step={100}
            onChange={(e) => setRoomSize(activePlan.room.width, Number(e.target.value))}
          />
        </label>
      </section>

      <section className="p-3 border-b border-slate-200 space-y-2">
        <div className="text-xs font-semibold text-slate-500">表示・スナップ</div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={project.settings.showGrid}
            onChange={(e) => setSettings({ showGrid: e.target.checked })}
          />
          グリッド表示
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={project.settings.snapToGrid}
            onChange={(e) => setSettings({ snapToGrid: e.target.checked })}
          />
          グリッドスナップ
        </label>
        <label className="block text-xs">
          グリッド (mm)
          <input
            type="number"
            className="mt-0.5 w-full border rounded px-2 py-1 text-sm"
            value={project.settings.gridSize}
            min={50}
            step={50}
            onChange={(e) => setSettings({ gridSize: Number(e.target.value) })}
          />
        </label>
        <label className="block text-xs">
          基準通路幅 (mm)
          <input
            type="number"
            className="mt-0.5 w-full border rounded px-2 py-1 text-sm"
            value={project.settings.minAisleWidth}
            min={600}
            step={100}
            onChange={(e) => setSettings({ minAisleWidth: Number(e.target.value) })}
          />
        </label>
      </section>

      <section className="p-3 space-y-2">
        <div className="text-xs font-semibold text-slate-500">選択オブジェクト</div>
        {!obj ? (
          <div className="text-xs text-slate-400">何も選択されていません</div>
        ) : (
          <>
            <div className="text-sm font-medium">{obj.label}</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label>
                X
                <input
                  type="number"
                  className="mt-0.5 w-full border rounded px-2 py-1"
                  value={obj.x}
                  step={50}
                  onChange={(e) => updateObject(obj.id, { x: Number(e.target.value) })}
                />
              </label>
              <label>
                Y
                <input
                  type="number"
                  className="mt-0.5 w-full border rounded px-2 py-1"
                  value={obj.y}
                  step={50}
                  onChange={(e) => updateObject(obj.id, { y: Number(e.target.value) })}
                />
              </label>
              <label>
                W
                <input
                  type="number"
                  className="mt-0.5 w-full border rounded px-2 py-1"
                  value={obj.width}
                  step={50}
                  onChange={(e) => updateObject(obj.id, { width: Number(e.target.value) })}
                />
              </label>
              <label>
                H
                <input
                  type="number"
                  className="mt-0.5 w-full border rounded px-2 py-1"
                  value={obj.height}
                  step={50}
                  onChange={(e) => updateObject(obj.id, { height: Number(e.target.value) })}
                />
              </label>
            </div>
            <div className="text-xs">回転: {obj.rotation}°</div>
            <div className="flex gap-2">
              <button
                onClick={() => rotateObject(obj.id)}
                className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-100"
              >
                90°回転
              </button>
              <button
                onClick={() => deleteObject(obj.id)}
                className="px-2 py-1 text-xs rounded border border-red-300 text-red-700 hover:bg-red-50"
              >
                削除
              </button>
            </div>
            {obj.seats != null && (
              <div className="text-xs text-slate-600">席数: {obj.seats}</div>
            )}
          </>
        )}
      </section>
    </aside>
  );
};
