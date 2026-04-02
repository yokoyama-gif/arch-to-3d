import { Plan, PlanComparison, Score } from '../types';
import { calculateScore } from './scoring';

export function getPlanComparison(plan: Plan): PlanComparison {
  const boxes = plan.objects.filter((o) => o.type === 'delivery_box');
  const score = calculateScore(plan.room, plan.objects, plan.judgments);

  const getObjectRect = (obj: { width: number; depth: number; rotation: number }) => {
    const isRotated = obj.rotation === 90 || obj.rotation === 270;
    return { width: isRotated ? obj.depth : obj.width, height: isRotated ? obj.width : obj.depth };
  };

  let totalWidth = 0;
  let occupiedArea = 0;
  for (const box of boxes) {
    const r = getObjectRect(box);
    totalWidth += r.width;
    occupiedArea += r.width * r.height;
  }

  return {
    planId: plan.id,
    planName: plan.name,
    boxCount: boxes.length,
    smallCount: boxes.filter((b) => (b.width || 0) <= 420).length,
    mediumCount: boxes.filter((b) => (b.width || 0) > 420 && (b.width || 0) <= 550).length,
    largeCount: boxes.filter((b) => (b.width || 0) > 550).length,
    totalWidth,
    occupiedArea,
    minCorridorWidth: calculateMinCorridorWidth(plan),
    ngCount: plan.judgments.filter((j) => j.level === 'ng').length,
    warningCount: plan.judgments.filter((j) => j.level === 'warning').length,
    score,
    memo: plan.memo,
  };
}

function calculateMinCorridorWidth(plan: Plan): number {
  const boxes = plan.objects.filter((o) => o.type === 'delivery_box');
  if (boxes.length === 0) return plan.room.width;

  let minGap = Infinity;
  for (const box of boxes) {
    const isRotated = box.rotation === 90 || box.rotation === 270;
    const w = isRotated ? box.depth : box.width;
    const d = isRotated ? box.width : box.depth;

    const gapLeft = box.x;
    const gapRight = plan.room.width - (box.x + w);
    const gapTop = box.y;
    const gapBottom = plan.room.depth - (box.y + d);

    minGap = Math.min(minGap, gapLeft, gapRight, gapTop, gapBottom);
  }

  return Math.max(0, Math.round(minGap));
}

export function exportComparisonCSV(comparisons: PlanComparison[]): string {
  const headers = [
    '案名', '設置台数', '小型', '中型', '大型', '総幅(mm)', '占有面積(mm²)',
    '最小通路幅(mm)', 'NG数', '注意数', '総合スコア', 'メモ',
  ];
  const rows = comparisons.map((c) => [
    c.planName, c.boxCount, c.smallCount, c.mediumCount, c.largeCount,
    c.totalWidth, c.occupiedArea, c.minCorridorWidth, c.ngCount, c.warningCount,
    c.score.total, `"${c.memo.replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function exportReportHTML(plan: Plan, comparison: PlanComparison, canvasDataUrl?: string): string {
  const s = comparison.score;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>宅配ボックス配置レポート - ${plan.name}</title>
<style>
  body { font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
  h1 { border-bottom: 3px solid #4A90D9; padding-bottom: 8px; }
  h2 { color: #4A90D9; margin-top: 24px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; }
  .ok { color: #4CAF50; font-weight: bold; }
  .warning { color: #FFC107; font-weight: bold; }
  .ng { color: #F44336; font-weight: bold; }
  .score-total { font-size: 24px; font-weight: bold; color: #4A90D9; }
  .plan-image { max-width: 100%; border: 1px solid #ddd; margin: 12px 0; }
  .meta { color: #666; font-size: 0.9em; }
</style>
</head>
<body>
<h1>宅配ボックス配置レポート</h1>
<p class="meta">案名: ${plan.name} ｜ 空間: ${plan.room.name} (${plan.room.width}×${plan.room.depth}mm) ｜ 作成日: ${new Date().toLocaleDateString('ja-JP')}</p>

${canvasDataUrl ? `<h2>平面図</h2><img class="plan-image" src="${canvasDataUrl}" alt="配置図" />` : ''}

<h2>配置概要</h2>
<table>
  <tr><th>項目</th><th>値</th></tr>
  <tr><td>設置台数</td><td>${comparison.boxCount}台</td></tr>
  <tr><td>小型/中型/大型</td><td>${comparison.smallCount}/${comparison.mediumCount}/${comparison.largeCount}</td></tr>
  <tr><td>総幅</td><td>${comparison.totalWidth}mm</td></tr>
  <tr><td>占有面積</td><td>${(comparison.occupiedArea / 1000000).toFixed(2)}m²</td></tr>
  <tr><td>最小通路幅</td><td>${comparison.minCorridorWidth}mm</td></tr>
</table>

<h2>判定結果</h2>
<table>
  <tr><th>レベル</th><th>件数</th></tr>
  <tr><td class="ng">NG</td><td>${comparison.ngCount}件</td></tr>
  <tr><td class="warning">注意</td><td>${comparison.warningCount}件</td></tr>
</table>

${plan.judgments.length > 0 ? `
<h3>詳細</h3>
<table>
  <tr><th>レベル</th><th>内容</th></tr>
  ${plan.judgments.map((j) => `<tr><td class="${j.level}">${j.level === 'ng' ? 'NG' : j.level === 'warning' ? '注意' : 'OK'}</td><td>${j.message}</td></tr>`).join('')}
</table>
` : ''}

<h2>スコア</h2>
<p class="score-total">総合: ${s.total}点 / 100点</p>
<table>
  <tr><th>項目</th><th>スコア</th></tr>
  <tr><td>配置効率</td><td>${s.placementEfficiency}</td></tr>
  <tr><td>動線の良さ</td><td>${s.circulationQuality}</td></tr>
  <tr><td>利用しやすさ</td><td>${s.usability}</td></tr>
  <tr><td>圧迫感の少なさ</td><td>${s.spaciousness}</td></tr>
  <tr><td>他設備との整合性</td><td>${s.equipmentCompatibility}</td></tr>
  <tr><td>施工性</td><td>${s.constructability}</td></tr>
</table>

${plan.memo ? `<h2>メモ</h2><p>${plan.memo}</p>` : ''}

<hr>
<p class="meta">宅配ボックス配置設計シミュレータ出力</p>
</body>
</html>`;
}
