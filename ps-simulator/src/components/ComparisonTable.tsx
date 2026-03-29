import type { PlanSummary } from "../domain/types";

type SavedPlan = {
  name: string;
  summary: PlanSummary;
};

type Props = {
  currentSummary?: PlanSummary;
  savedPlans: SavedPlan[];
  onDelete: (name: string) => void;
  onLoad: (name: string) => void;
};

function SummaryRow({
  summary,
  isCurrent,
  onLoad,
  onDelete,
}: {
  summary: PlanSummary;
  isCurrent?: boolean;
  onLoad?: () => void;
  onDelete?: () => void;
}) {
  return (
    <tr
      style={{
        borderBottom: "1px solid #eee",
        background: isCurrent ? "#e3f2fd" : undefined,
      }}
    >
      <td style={tdStyle}>
        {summary.name}
        {isCurrent && (
          <span style={{ fontSize: 9, color: "#1976d2", marginLeft: 4 }}>
            (現在)
          </span>
        )}
      </td>
      <td style={{ ...tdStyle, textAlign: "right" }}>
        {(summary.psAreaMm2 / 1000000).toFixed(3)}m²
      </td>
      <td style={{ ...tdStyle, textAlign: "right" }}>
        {(summary.totalPipeLengthMm / 1000).toFixed(1)}m
      </td>
      <td style={{ ...tdStyle, textAlign: "center", color: "#ff9800" }}>
        {summary.warningCount}
      </td>
      <td style={{ ...tdStyle, textAlign: "center", color: "#f44336" }}>
        {summary.ngCount}
      </td>
      <td style={{ ...tdStyle, textAlign: "right" }}>
        {summary.maintenanceScore}
      </td>
      <td style={{ ...tdStyle, textAlign: "right" }}>
        {summary.constructabilityScore}
      </td>
      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
        {summary.totalScore}
      </td>
      <td style={tdStyle}>
        {!isCurrent && (
          <>
            <button
              onClick={onLoad}
              style={{ fontSize: 10, marginRight: 4, cursor: "pointer" }}
            >
              読込
            </button>
            <button
              onClick={onDelete}
              style={{ fontSize: 10, cursor: "pointer", color: "#f44336" }}
            >
              削除
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

export function ComparisonTable({
  currentSummary,
  savedPlans,
  onDelete,
  onLoad,
}: Props) {
  const hasData = currentSummary || savedPlans.length > 0;

  if (!hasData) {
    return (
      <div style={{ fontSize: 12, color: "#999" }}>
        保存された案がありません。「案を保存」で保存してください。
      </div>
    );
  }

  return (
    <div style={{ fontSize: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #ccc" }}>
            <th style={thStyle}>案名</th>
            <th style={thStyle}>PS面積</th>
            <th style={thStyle}>総延長</th>
            <th style={thStyle}>WARN</th>
            <th style={thStyle}>NG</th>
            <th style={thStyle}>点検性</th>
            <th style={thStyle}>施工性</th>
            <th style={thStyle}>総合</th>
            <th style={thStyle}></th>
          </tr>
        </thead>
        <tbody>
          {/* 現在案（常に先頭に表示） */}
          {currentSummary && (
            <SummaryRow summary={currentSummary} isCurrent />
          )}
          {/* 保存済み案 */}
          {savedPlans.map((p) => (
            <SummaryRow
              key={p.name}
              summary={p.summary}
              onLoad={() => onLoad(p.name)}
              onDelete={() => onDelete(p.name)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "3px 4px",
  fontSize: 11,
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "3px 4px",
  fontSize: 11,
};
