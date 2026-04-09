import { getSortedIssueBreakdown, issueCodeLabels } from '../../logic/evaluation/issueSummary';
import type { Project } from '../../models/types';

type Props = {
  project: Project;
  activePlanId: string;
};

const rankPlans = (project: Project) =>
  [...project.plans].sort((left, right) => {
    if (right.evaluation.metrics.score !== left.evaluation.metrics.score) {
      return right.evaluation.metrics.score - left.evaluation.metrics.score;
    }
    if (left.evaluation.metrics.ngCount !== right.evaluation.metrics.ngCount) {
      return left.evaluation.metrics.ngCount - right.evaluation.metrics.ngCount;
    }
    return right.evaluation.metrics.totalSeats - left.evaluation.metrics.totalSeats;
  });

const Metric = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <div className="rounded-2xl bg-slate-50 px-3 py-2">
    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
      {label}
    </div>
    <div className="mt-1 text-base font-semibold text-ink">{value}</div>
  </div>
);

export const ComparisonPanel = ({ project, activePlanId }: Props) => {
  const rankedPlans = rankPlans(project);
  const bestPlanId = rankedPlans[0]?.id;

  return (
    <section className="rounded-3xl bg-panel p-4 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">案比較</h2>
          <p className="mt-1 text-sm text-slate-500">
            総合点だけでなく、通路・圧迫感・判定内訳を横並びで確認できます。
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
          {project.plans.length}案
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {rankedPlans.map((plan) => {
          const issueBreakdown = getSortedIssueBreakdown(plan.evaluation.issues).slice(0, 4);
          const isBest = plan.id === bestPlanId;
          const isActive = plan.id === activePlanId;

          return (
            <article
              key={plan.id}
              className={`rounded-3xl border p-4 transition ${
                isActive
                  ? 'border-slate-900 bg-white shadow-sm'
                  : 'border-slate-200 bg-white/80'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-ink">{plan.name}</h3>
                    {isBest ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                        ベスト案
                      </span>
                    ) : null}
                    {isActive ? (
                      <span className="rounded-full bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                        表示中
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Warning {plan.evaluation.metrics.warningCount} / NG {plan.evaluation.metrics.ngCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-900 px-3 py-2 text-right text-white">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
                    Score
                  </div>
                  <div className="text-2xl font-semibold">{plan.evaluation.metrics.score}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Metric label="総席数" value={`${plan.evaluation.metrics.totalSeats}席`} />
                <Metric label="会議席数" value={`${plan.evaluation.metrics.meetingSeats}席`} />
                <Metric label="最小通路幅" value={`${plan.evaluation.metrics.minCorridorWidth}mm`} />
                <Metric label="占有率" value={`${plan.evaluation.metrics.occupiedAreaRatio}%`} />
                <Metric label="共用比率" value={`${plan.evaluation.metrics.sharedAreaRatio}%`} />
                <Metric label="圧迫指数" value={plan.evaluation.metrics.pressureIndex} />
              </div>

              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  判定内訳
                </div>
                {issueBreakdown.length === 0 ? (
                  <div className="mt-2 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                    主要な警告はありません
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {issueBreakdown.map(([code, count]) => (
                      <span
                        key={`${plan.id}-${code}`}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                      >
                        {issueCodeLabels[code]} {count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
