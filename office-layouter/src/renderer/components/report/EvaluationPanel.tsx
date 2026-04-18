import {
  getIssueCountsBySeverity,
  getSortedIssueBreakdown,
  issueCodeLabels,
  severityLabels,
} from '../../logic/evaluation/issueSummary';
import type { LayoutPlan, Severity } from '../../models/types';

type Props = {
  plan: LayoutPlan;
};

const severityClasses: Record<Severity, string> = {
  ok: 'bg-green-100 text-ok',
  warning: 'bg-amber-100 text-warning',
  ng: 'bg-red-100 text-danger',
};

const MetricCard = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <div className="rounded-2xl bg-white p-3 shadow-sm">
    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
      {label}
    </div>
    <div className="mt-2 text-xl font-semibold text-ink">{value}</div>
  </div>
);

export const EvaluationPanel = ({ plan }: Props) => {
  const { metrics, issues } = plan.evaluation;
  const severityCounts = getIssueCountsBySeverity(issues);
  const issueBreakdown = getSortedIssueBreakdown(issues);

  return (
    <section className="rounded-3xl bg-panel p-4 shadow-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">評価パネル</h2>
          <p className="mt-1 text-sm text-slate-500">
            初期レイアウト検討用の簡易判定です。数値は概算として扱ってください。
          </p>
        </div>
        <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          総合点 {metrics.score}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-7">
        <MetricCard label="総席数" value={`${metrics.totalSeats}席`} />
        <MetricCard label="会議席数" value={`${metrics.meetingSeats}席`} />
        <MetricCard label="占有率" value={`${metrics.occupiedAreaRatio}%`} />
        <MetricCard label="最小通路幅" value={`${metrics.minCorridorWidth}mm`} />
        <MetricCard label="Warning数" value={metrics.warningCount} />
        <MetricCard label="NG数" value={metrics.ngCount} />
        <MetricCard label="判定数" value={issues.length} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <MetricCard label="ゾーン数" value={metrics.zoneCount} />
        <MetricCard label="共用比率" value={`${metrics.sharedAreaRatio}%`} />
        <MetricCard label="圧迫指数" value={metrics.pressureIndex} />
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          判定サマリー
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(severityCounts) as Severity[]).map((severity) => (
            <span
              key={severity}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${severityClasses[severity]}`}
            >
              {severityLabels[severity]} {severityCounts[severity]}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          判定内訳
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {issueBreakdown.length === 0 ? (
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-ok">
              主要な警告はありません
            </span>
          ) : (
            issueBreakdown.map(([code, count]) => (
              <span
                key={code}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
              >
                {issueCodeLabels[code]} {count}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 max-h-56 space-y-2 overflow-auto pr-1">
        {issues.length === 0 ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-ok">
            現在のルール範囲では重大な干渉は見つかっていません。
          </div>
        ) : (
          issues.map((issue) => (
            <div
              key={issue.id}
              className="rounded-2xl border border-slate-200 bg-white p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-ink">{issue.title}</div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${severityClasses[issue.severity]}`}
                >
                  {severityLabels[issue.severity]}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{issue.description}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
