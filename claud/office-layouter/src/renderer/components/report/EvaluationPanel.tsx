import React from "react";
import { useProjectStore } from "../../store/projectStore";
import { evaluate } from "../../logic/evaluation";

export const EvaluationPanel: React.FC = () => {
  const project = useProjectStore((s) => s.project);
  const plan = project.plans.find((p) => p.id === project.activePlanId)!;
  const result = evaluate(plan, project.settings);

  const tone =
    result.ngCount > 0 ? "bg-red-50 border-red-300" : result.warnCount > 0 ? "bg-yellow-50 border-yellow-300" : "bg-green-50 border-green-300";

  return (
    <div className={`border-t ${tone} px-4 py-2 text-xs grid grid-cols-7 gap-2 items-center`}>
      <Stat label="総席数" value={`${result.totalSeats} 席`} />
      <Stat label="会議席数" value={`${result.meetingSeats} 席`} />
      <Stat label="占有率" value={`${Math.round(result.occupancyRatio * 100)}%`} />
      <Stat
        label="最小通路幅"
        value={`${Math.round(result.minAisleWidth)} mm`}
      />
      <Stat label="warning" value={`${result.warnCount}`} tone={result.warnCount > 0 ? "warn" : undefined} />
      <Stat label="ng" value={`${result.ngCount}`} tone={result.ngCount > 0 ? "ng" : undefined} />
      <Stat label="総合点" value={`${result.score}`} bold />
      <div className="col-span-7 max-h-20 overflow-y-auto pt-1 border-t border-slate-200/60">
        {result.issues.length === 0 ? (
          <span className="text-green-700">指摘なし。初期レイアウト検討用の簡易判定です。</span>
        ) : (
          <ul className="space-y-0.5">
            {result.issues.slice(0, 30).map((i) => (
              <li
                key={i.id}
                className={
                  i.severity === "ng"
                    ? "text-red-700"
                    : i.severity === "warn"
                      ? "text-yellow-700"
                      : "text-slate-600"
                }
              >
                ・{i.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; tone?: "warn" | "ng"; bold?: boolean }> = ({
  label,
  value,
  tone,
  bold,
}) => {
  const color =
    tone === "ng" ? "text-red-700" : tone === "warn" ? "text-yellow-700" : "text-slate-700";
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className={`${color} ${bold ? "font-bold text-base" : "text-sm font-semibold"}`}>
        {value}
      </span>
    </div>
  );
};
