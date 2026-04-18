import type { LayoutPlan, Project } from '../../models/types';

const issueColor = {
  ok: '#15803d',
  warning: '#d97706',
  ng: '#dc2626',
};

export const buildPlanReportHtml = (project: Project, plan: LayoutPlan) => `
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <title>${plan.name} レポート</title>
    <style>
      body { font-family: 'Segoe UI', sans-serif; color: #0f172a; padding: 32px; }
      h1, h2 { margin: 0 0 12px; }
      p { margin: 0 0 12px; color: #475569; }
      .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
      .card { border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px; background: #f8fafc; }
      .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; }
      .value { font-size: 24px; font-weight: 700; margin-top: 8px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { text-align: left; border-bottom: 1px solid #e2e8f0; padding: 8px 6px; font-size: 12px; }
      .issue { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
      .issue strong { color: inherit; }
    </style>
  </head>
  <body>
    <h1>${project.name} / ${plan.name}</h1>
    <p>初期レイアウト検討用の簡易判定です。法適合判定には使用しないでください。</p>
    <div class="grid">
      <div class="card"><div class="label">総席数</div><div class="value">${plan.evaluation.metrics.totalSeats}</div></div>
      <div class="card"><div class="label">会議席数</div><div class="value">${plan.evaluation.metrics.meetingSeats}</div></div>
      <div class="card"><div class="label">占有率</div><div class="value">${plan.evaluation.metrics.occupiedAreaRatio}%</div></div>
      <div class="card"><div class="label">総合点</div><div class="value">${plan.evaluation.metrics.score}</div></div>
    </div>
    <h2>オブジェクト一覧</h2>
    <table>
      <thead>
        <tr><th>名称</th><th>カテゴリ</th><th>座標</th><th>サイズ</th><th>席数</th></tr>
      </thead>
      <tbody>
        ${plan.objects
          .map(
            (object) => `
              <tr>
                <td>${object.name}</td>
                <td>${object.category}</td>
                <td>${object.x}, ${object.y}</td>
                <td>${object.width} x ${object.height}</td>
                <td>${object.seatCount}</td>
              </tr>`,
          )
          .join('')}
      </tbody>
    </table>
    <h2>評価</h2>
    ${plan.evaluation.issues
      .map(
        (issue) => `
          <div class="issue" style="color:${issueColor[issue.severity]};">
            <strong>${issue.title}</strong><br />
            <span>${issue.description}</span>
          </div>`,
      )
      .join('')}
  </body>
</html>`;
