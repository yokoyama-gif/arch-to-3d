import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { defaultTemplates } from '../data/presets';
import { getRecommendedConfig } from '../utils/scoring';
import { getPlanComparison, exportComparisonCSV, exportReportHTML } from '../utils/export';
import { getCanvasDataUrl } from './PlanCanvas';

export const Toolbar: React.FC = () => {
  const {
    project, viewMode, setViewMode, setActivePlan, addPlan, deletePlan,
    renamePlan, duplicatePlan, updatePlanMemo, saveToLocalStorage,
    loadFromLocalStorage, exportProject, importProject, applyTemplate,
    updateProject,
  } = useStore();
  const plan = useStore((s) => s.activePlan());

  const [showTemplates, setShowTemplates] = useState(false);
  const [showRecommend, setShowRecommend] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [recForm, setRecForm] = useState({ units: 12, family: false, freq: 'medium' as const, mail: false });

  const handleSave = () => { saveToLocalStorage(); alert('保存しました'); };
  const handleLoad = () => { if (loadFromLocalStorage()) alert('読み込みました'); else alert('保存データがありません'); };

  const handleExportJSON = () => {
    const json = exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, `${project.name}.json`);
  };

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => importProject(reader.result as string);
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExportPNG = () => {
    const dataUrl = getCanvasDataUrl();
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `${plan.name}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  const handleExportCSV = () => {
    const comparisons = project.plans.map(getPlanComparison);
    const csv = exportComparisonCSV(comparisons);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, '比較表.csv');
  };

  const handleExportReport = () => {
    const comparison = getPlanComparison(plan);
    const dataUrl = getCanvasDataUrl();
    const html = exportReportHTML(plan, comparison, dataUrl || undefined);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, `レポート_${plan.name}.html`);
  };

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={styles.toolbar}>
      <div style={styles.left}>
        <input style={styles.projectName} value={project.name}
          onChange={(e) => updateProject({ name: e.target.value })} />
        <span style={styles.divider}>|</span>

        {/* Plan tabs */}
        {project.plans.map((p) => (
          <button
            key={p.id}
            style={{
              ...styles.tab,
              background: p.id === project.activePlanId ? '#4A90D9' : '#e8e8e8',
              color: p.id === project.activePlanId ? '#fff' : '#333',
            }}
            onClick={() => { setActivePlan(p.id); setViewMode('plan'); }}
            onDoubleClick={() => {
              const name = prompt('案名を入力', p.name);
              if (name) renamePlan(p.id, name);
            }}
          >
            {p.name}
          </button>
        ))}
        <button style={styles.addTab} onClick={() => addPlan()}>＋</button>

        {project.plans.length > 1 && (
          <button style={styles.smallBtn} onClick={() => {
            if (confirm(`「${plan.name}」を削除しますか？`)) deletePlan(plan.id);
          }}>案を削除</button>
        )}
        <button style={styles.smallBtn} onClick={() => duplicatePlan(plan.id)}>案を複製</button>
      </div>

      <div style={styles.right}>
        <button style={{ ...styles.viewBtn, background: viewMode === 'plan' ? '#4A90D9' : '#e8e8e8', color: viewMode === 'plan' ? '#fff' : '#333' }}
          onClick={() => setViewMode('plan')}>配置</button>
        <button style={{ ...styles.viewBtn, background: viewMode === 'compare' ? '#4A90D9' : '#e8e8e8', color: viewMode === 'compare' ? '#fff' : '#333' }}
          onClick={() => setViewMode('compare')}>比較</button>

        <span style={styles.divider}>|</span>

        <button style={styles.btn} onClick={() => setShowTemplates(!showTemplates)}>テンプレート</button>
        <button style={styles.btn} onClick={() => setShowRecommend(!showRecommend)}>推奨構成</button>

        <span style={styles.divider}>|</span>

        <button style={styles.btn} onClick={handleSave}>保存</button>
        <button style={styles.btn} onClick={handleLoad}>読込</button>
        <button style={styles.btn} onClick={() => setShowExport(!showExport)}>出力 ▾</button>
        <button style={styles.btn} onClick={handleExportJSON}>JSON</button>
        <button style={styles.btn} onClick={handleImportJSON}>読込(JSON)</button>
      </div>

      {/* Templates dropdown */}
      {showTemplates && (
        <div style={styles.dropdown}>
          <h4 style={{ margin: '0 0 8px' }}>テンプレート</h4>
          {defaultTemplates.map((t) => (
            <div key={t.id} style={styles.dropdownItem} onClick={() => {
              applyTemplate(t.room, t.objects);
              setShowTemplates(false);
            }}>
              <strong>{t.name}</strong>
              <div style={{ fontSize: 11, color: '#666' }}>{t.description}</div>
            </div>
          ))}
          <button style={styles.closeBtn} onClick={() => setShowTemplates(false)}>閉じる</button>
        </div>
      )}

      {/* Recommend dropdown */}
      {showRecommend && (
        <div style={styles.dropdown}>
          <h4 style={{ margin: '0 0 8px' }}>推奨構成提案</h4>
          <div style={styles.recForm}>
            <label>総戸数: <input type="number" value={recForm.units} onChange={(e) => setRecForm({ ...recForm, units: +e.target.value })} style={styles.recInput} /></label>
            <label><input type="checkbox" checked={recForm.family} onChange={(e) => setRecForm({ ...recForm, family: e.target.checked })} /> ファミリー混在</label>
            <label>EC利用頻度:
              <select value={recForm.freq} onChange={(e) => setRecForm({ ...recForm, freq: e.target.value as any })}>
                <option value="low">低</option><option value="medium">中</option><option value="high">高</option>
              </select>
            </label>
            <label><input type="checkbox" checked={recForm.mail} onChange={(e) => setRecForm({ ...recForm, mail: e.target.checked })} /> メール一体型希望</label>
          </div>
          {getRecommendedConfig(recForm.units, recForm.family, recForm.freq, recForm.mail).map((c, i) => (
            <div key={i} style={styles.recResult}>
              <strong>{c.label}</strong>: 計{c.totalBoxes}台 (小{c.small} / 中{c.medium} / 大{c.large}{c.mailIntegrated > 0 ? ` / メール一体${c.mailIntegrated}` : ''})
            </div>
          ))}
          <button style={styles.closeBtn} onClick={() => setShowRecommend(false)}>閉じる</button>
        </div>
      )}

      {/* Export dropdown */}
      {showExport && (
        <div style={{ ...styles.dropdown, right: 8 }}>
          <h4 style={{ margin: '0 0 8px' }}>出力</h4>
          <button style={styles.exportBtn} onClick={() => { handleExportPNG(); setShowExport(false); }}>PNG画像</button>
          <button style={styles.exportBtn} onClick={() => { handleExportReport(); setShowExport(false); }}>HTMLレポート</button>
          <button style={styles.exportBtn} onClick={() => { handleExportCSV(); setShowExport(false); }}>比較表CSV</button>
          <button style={styles.closeBtn} onClick={() => setShowExport(false)}>閉じる</button>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderBottom: '1px solid #e0e0e0', padding: '4px 8px', position: 'relative', flexWrap: 'wrap', gap: 4 },
  left: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  right: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  projectName: { border: '1px solid #ddd', borderRadius: 4, padding: '4px 8px', fontSize: 13, fontWeight: 700, width: 140 },
  divider: { color: '#ccc', margin: '0 4px' },
  tab: { padding: '4px 12px', border: 'none', borderRadius: '4px 4px 0 0', cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  addTab: { padding: '4px 8px', border: '1px dashed #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 12, background: '#f5f5f5' },
  smallBtn: { padding: '3px 8px', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', fontSize: 11, background: '#f5f5f5' },
  btn: { padding: '4px 10px', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', fontSize: 12, background: '#f5f5f5' },
  viewBtn: { padding: '4px 14px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  dropdown: { position: 'absolute', top: '100%', left: 8, background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 12, zIndex: 100, minWidth: 320, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
  dropdownItem: { padding: '8px', borderRadius: 4, cursor: 'pointer', marginBottom: 4, border: '1px solid #eee' },
  closeBtn: { width: '100%', padding: 6, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginTop: 8, background: '#f5f5f5' },
  recForm: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, marginBottom: 8 },
  recInput: { width: 60, marginLeft: 4, padding: '2px 4px', border: '1px solid #ccc', borderRadius: 3 },
  recResult: { fontSize: 12, padding: '4px 0', borderBottom: '1px solid #eee' },
  exportBtn: { display: 'block', width: '100%', padding: '6px 12px', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginBottom: 4, background: '#f5f5f5', textAlign: 'left' },
};
