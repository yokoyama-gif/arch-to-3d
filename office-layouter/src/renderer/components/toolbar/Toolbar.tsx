import { buildPlanReportHtml } from '../../logic/export/pdf';
import { exportSvgElementToPngBytes } from '../../logic/export/png';
import { exportPlanToCsv } from '../../logic/export/csv';
import { useProjectStore } from '../../store/projectStore';

export const Toolbar = () => {
  const project = useProjectStore((state) => state.project);
  const activePlanId = useProjectStore((state) => state.activePlanId);
  const lastSavedPath = useProjectStore((state) => state.lastSavedPath);
  const selectedObjectId = useProjectStore((state) => state.selectedObjectId);
  const saveProjectToFile = useProjectStore((state) => state.saveProjectToFile);
  const loadProjectFromFile = useProjectStore((state) => state.loadProjectFromFile);
  const addPlan = useProjectStore((state) => state.addPlan);
  const duplicatePlan = useProjectStore((state) => state.duplicatePlan);
  const switchPlan = useProjectStore((state) => state.switchPlan);
  const rotateSelectedObject = useProjectStore((state) => state.rotateSelectedObject);
  const deleteSelectedObject = useProjectStore((state) => state.deleteSelectedObject);
  const toggleComparison = useProjectStore((state) => state.toggleComparison);
  const autoArrangeCurrentPlan = useProjectStore((state) => state.autoArrangeCurrentPlan);

  const activePlan =
    project.plans.find((plan) => plan.id === activePlanId) ?? project.plans[0];

  const exportCsv = async () => {
    if (!activePlan || !window.officeApi) {
      return;
    }
    await window.officeApi.saveTextFile({
      defaultPath: `${activePlan.name}.csv`,
      content: exportPlanToCsv(activePlan),
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
  };

  const exportPdf = async () => {
    if (!activePlan || !window.officeApi) {
      return;
    }
    await window.officeApi.exportPdf({
      defaultPath: `${activePlan.name}.pdf`,
      html: buildPlanReportHtml(project, activePlan),
    });
  };

  const exportPng = async () => {
    if (!activePlan || !window.officeApi) {
      return;
    }
    const svg = document.getElementById('office-layout-canvas') as SVGSVGElement | null;
    if (!svg) {
      return;
    }
    const bounds = svg.getBoundingClientRect();
    const width = Math.max(1200, Math.round(bounds.width * 2));
    const height = Math.max(800, Math.round(bounds.height * 2));
    const bytes = await exportSvgElementToPngBytes(svg, width, height);
    await window.officeApi.saveBinaryFile({
      defaultPath: `${activePlan.name}.png`,
      bytes: Array.from(bytes),
      filters: [{ name: 'PNG', extensions: ['png'] }],
    });
  };

  return (
    <header className="rounded-3xl bg-panel p-4 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{project.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            初期レイアウト検討用の簡易判定です。法適合判定には使用しないでください。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void saveProjectToFile()}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            保存
          </button>
          <button
            type="button"
            onClick={() => void loadProjectFromFile()}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            読込
          </button>
          <button
            type="button"
            onClick={addPlan}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            新規案
          </button>
          <button
            type="button"
            onClick={duplicatePlan}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            案を複製
          </button>
          <button
            type="button"
            onClick={autoArrangeCurrentPlan}
            className="rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700"
          >
            自動整列
          </button>
          <button
            type="button"
            onClick={toggleComparison}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            比較表示
          </button>
          <button
            type="button"
            onClick={() => void exportPng()}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            PNG出力
          </button>
          <button
            type="button"
            onClick={() => void exportPdf()}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            PDF出力
          </button>
          <button
            type="button"
            onClick={() => void exportCsv()}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            CSV出力
          </button>
          <button
            type="button"
            onClick={rotateSelectedObject}
            disabled={!selectedObjectId}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            回転
          </button>
          <button
            type="button"
            onClick={deleteSelectedObject}
            disabled={!selectedObjectId}
            className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            削除
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {project.plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => switchPlan(plan.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              plan.id === activePlanId
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {plan.name}
          </button>
        ))}
        {lastSavedPath ? (
          <span className="ml-auto text-xs text-slate-500">保存先: {lastSavedPath}</span>
        ) : null}
      </div>
    </header>
  );
};
