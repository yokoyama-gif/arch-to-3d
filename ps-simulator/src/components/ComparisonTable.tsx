import type { PlanSummary } from "../domain/types";

type SavedPlan = {
  name: string;
  summary: PlanSummary;
};

type Props = {
  savedPlans: SavedPlan[];
  onDelete: (name: string) => void;
  onLoad: (name: string) => void;
};

export function ComparisonTable({ savedPlans, onDelete, onLoad }: Props) {
  if (savedPlans.length === 0) {
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
          {savedPlans.map((p) => (
            <tr key={p.name} style={{ borderBottom: "1px solid #eee" }}>
              <td style={tdStyle}>{p.name}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>
                {(p.summary.psAreaMm2 / 1000000).toFixed(3)}m²
              </td>
              <td style={{ ...tdStyle, textAlign: "right" }}>
                {(p.summary.totalPipeLengthMm / 1000).toFixed(1)}m
              </td>
              <td style={{ ...tdStyle, textAlign: "center", color: "#ff9800" }}>
                {p.summary.warningCount}
              </td>
              <td style={{ ...tdStyle, textAlign: "center", color: "#f44336" }}>
                {p.summary.ngCount}
              </td>
              <td style={{ ...tdStyle, textAlign: "right" }}>
                {p.summary.maintenanceScore}
              </td>
              <td style={{ ...tdStyle, textAlign: "right" }}>
                {p.summary.constructabilityScore}
              </td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                {p.summary.totalScore}
              </td>
              <td style={tdStyle}>
                <button
                  onClick={() => onLoad(p.name)}
                  style={{ fontSize: 10, marginRight: 4, cursor: "pointer" }}
                >
                  読込
                </button>
                <button
                  onClick={() => onDelete(p.name)}
                  style={{ fontSize: 10, cursor: "pointer", color: "#f44336" }}
                >
                  削除
                </button>
              </td>
            </tr>
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
