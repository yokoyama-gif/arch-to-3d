import React, { useRef } from "react";
import { useProjectStore } from "../../store/projectStore";
import {
  downloadJson,
  loadFromLocalStorage,
  readJsonFile,
  saveToLocalStorage,
} from "../../logic/export/json";

export const Toolbar: React.FC = () => {
  const project = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const addPlan = useProjectStore((s) => s.addPlan);
  const setActivePlan = useProjectStore((s) => s.setActivePlan);
  const removePlan = useProjectStore((s) => s.removePlan);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <header className="flex items-center gap-3 px-4 h-12 bg-white border-b border-slate-200">
      <div className="text-base font-bold mr-2">Office Layouter</div>
      <input
        className="border rounded px-2 py-1 text-sm w-56"
        value={project.name}
        onChange={(e) => setProjectName(e.target.value)}
      />

      <div className="flex items-center gap-1 ml-2">
        <span className="text-xs text-slate-500">案:</span>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={project.activePlanId}
          onChange={(e) => setActivePlan(e.target.value)}
        >
          {project.plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => addPlan()}
          className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-100"
        >
          ＋案追加
        </button>
        {project.plans.length > 1 && (
          <button
            onClick={() => removePlan(project.activePlanId)}
            className="px-2 py-1 text-xs rounded border border-red-300 text-red-700 hover:bg-red-50"
          >
            案削除
          </button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => {
            saveToLocalStorage(project);
            window.alert("ローカルに保存しました");
          }}
          className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          保存
        </button>
        <button
          onClick={() => {
            const loaded = loadFromLocalStorage();
            if (loaded) {
              setProject(loaded);
              window.alert("読み込みました");
            } else {
              window.alert("保存データがありません");
            }
          }}
          className="px-3 py-1 text-sm rounded border border-slate-300 hover:bg-slate-100"
        >
          読込
        </button>
        <button
          onClick={() => downloadJson(project)}
          className="px-3 py-1 text-sm rounded border border-slate-300 hover:bg-slate-100"
        >
          JSON出力
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="px-3 py-1 text-sm rounded border border-slate-300 hover:bg-slate-100"
        >
          JSON取込
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const p = await readJsonFile(file);
              setProject(p);
            } catch {
              window.alert("読込に失敗しました");
            } finally {
              e.target.value = "";
            }
          }}
        />
      </div>
    </header>
  );
};
