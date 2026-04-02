import React from 'react';
import { useStore } from '../store/useStore';
import { getPlanComparison } from '../utils/export';
import { calculateScore } from '../utils/scoring';
import { PlanComparison } from '../types';

export const CompareView: React.FC = () => {
  const { project, updatePlanMemo } = useStore();

  const comparisons: PlanComparison[] = project.plans.map((p) => {
    const score = calculateScore(p.room, p.objects, p.judgments);
    return { ...getPlanComparison(p), score };
  });

  const scoreLabels: Record<string, string> = {
    placementEfficiency: '配置効率',
    circulationQuality: '動線の良さ',
    usability: '利用しやすさ',
    spaciousness: '圧迫感の少なさ',
    equipmentCompatibility: '他設備との整合性',
    constructability: '施工性',
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>案比較</h2>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>項目</th>
              {comparisons.map((c) => (
                <th key={c.planId} style={styles.th}>{c.planName}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}>設置台数</td>
              {comparisons.map((c) => <td key={c.planId} style={styles.td}>{c.boxCount}台</td>)}
            </tr>
            <tr>
              <td style={styles.td}>小型/中型/大型</td>
              {comparisons.map((c) => <td key={c.planId} style={styles.td}>{c.smallCount}/{c.mediumCount}/{c.largeCount}</td>)}
            </tr>
            <tr>
              <td style={styles.td}>総幅</td>
              {comparisons.map((c) => <td key={c.planId} style={styles.td}>{c.totalWidth}mm</td>)}
            </tr>
            <tr>
              <td style={styles.td}>占有面積</td>
              {comparisons.map((c) => <td key={c.planId} style={styles.td}>{(c.occupiedArea / 1000000).toFixed(2)}m²</td>)}
            </tr>
            <tr>
              <td style={styles.td}>最小通路幅</td>
              {comparisons.map((c) => (
                <td key={c.planId} style={{ ...styles.td, color: c.minCorridorWidth < 800 ? '#F44336' : '#333' }}>
                  {c.minCorridorWidth}mm
                </td>
              ))}
            </tr>
            <tr>
              <td style={styles.td}>NG数</td>
              {comparisons.map((c) => (
                <td key={c.planId} style={{ ...styles.td, color: c.ngCount > 0 ? '#F44336' : '#4CAF50', fontWeight: 700 }}>
                  {c.ngCount}
                </td>
              ))}
            </tr>
            <tr>
              <td style={styles.td}>注意数</td>
              {comparisons.map((c) => (
                <td key={c.planId} style={{ ...styles.td, color: c.warningCount > 0 ? '#FFC107' : '#4CAF50', fontWeight: 700 }}>
                  {c.warningCount}
                </td>
              ))}
            </tr>
            <tr style={{ background: '#e3f2fd' }}>
              <td style={{ ...styles.td, fontWeight: 700 }}>総合スコア</td>
              {comparisons.map((c) => (
                <td key={c.planId} style={{ ...styles.td, fontWeight: 700, fontSize: 18, color: '#4A90D9' }}>
                  {c.score.total}点
                </td>
              ))}
            </tr>
            {Object.entries(scoreLabels).map(([key, label]) => (
              <tr key={key}>
                <td style={styles.td}>{label}</td>
                {comparisons.map((c) => (
                  <td key={c.planId} style={styles.td}>
                    {(c.score as any)[key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ marginTop: 24 }}>メモ</h3>
      <div style={styles.memoRow}>
        {project.plans.map((p) => (
          <div key={p.id} style={styles.memoCol}>
            <strong>{p.name}</strong>
            <textarea
              style={styles.textarea}
              value={p.memo}
              onChange={(e) => updatePlanMemo(p.id, e.target.value)}
              placeholder="営業説明メモ、注意点など..."
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { flex: 1, padding: 24, overflowY: 'auto', background: '#fafafa' },
  title: { margin: '0 0 16px', color: '#333' },
  tableWrap: { overflowX: 'auto' },
  table: { borderCollapse: 'collapse', width: '100%', background: '#fff' },
  th: { border: '1px solid #ddd', padding: '8px 12px', background: '#f5f5f5', fontSize: 13, fontWeight: 700, textAlign: 'center' },
  td: { border: '1px solid #ddd', padding: '6px 12px', fontSize: 13, textAlign: 'center' },
  memoRow: { display: 'flex', gap: 16 },
  memoCol: { flex: 1 },
  textarea: { width: '100%', minHeight: 80, padding: 8, border: '1px solid #ddd', borderRadius: 4, fontSize: 12, resize: 'vertical', marginTop: 4, boxSizing: 'border-box' },
};
