import { useMemo } from "react";
import type { SlopeResult, PsResult, Fixture } from "../domain/types";
import { structuralFixtureTypes } from "../domain/types";
import { fixtureLabels } from "../domain/rules/fixtureDefaults";
import { pipeTypeLabels } from "../domain/rules/pipeSpecs";
import { findOverlappingPairs } from "../utils/geometry";

type Props = {
  fixtures: Fixture[];
  slopeResults: SlopeResult[];
  psResults: PsResult[];
};

const statusColor = {
  ok: "#4caf50",
  warning: "#ff9800",
  ng: "#f44336",
};

const statusLabel = {
  ok: "OK",
  warning: "WARNING",
  ng: "NG",
};

export function ResultPanel({ fixtures, slopeResults, psResults }: Props) {
  const psList = fixtures.filter((f) => f.type === "ps");
  const hasPsWarning = psList.length === 0;

  // 重なり検出（構造要素は柱・梁・壁との重なりは設備配置上問題ないため除外）
  const overlaps = useMemo(
    () =>
      findOverlappingPairs(
        fixtures.filter((f) => !structuralFixtureTypes.has(f.type))
      ),
    [fixtures]
  );

  return (
    <div style={{ fontSize: 12 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>判定結果</h3>

      {/* 重なり警告 */}
      {overlaps.length > 0 && (
        <div
          style={{
            background: "#fce4ec",
            padding: 8,
            borderRadius: 4,
            marginBottom: 8,
            border: "1px solid #f44336",
            fontSize: 11,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>設備の重なりを検出</div>
          {overlaps.map(([a, b], i) => {
            const fa = fixtures.find((f) => f.id === a);
            const fb = fixtures.find((f) => f.id === b);
            return (
              <div key={i}>
                {fa ? fixtureLabels[fa.type] : "?"} ↔ {fb ? fixtureLabels[fb.type] : "?"}
              </div>
            );
          })}
        </div>
      )}

      {hasPsWarning && (
        <div
          style={{
            background: "#fff3e0",
            padding: 8,
            borderRadius: 4,
            marginBottom: 8,
            border: "1px solid #ff9800",
          }}
        >
          PSが配置されていません。PSを配置してください。
        </div>
      )}

      {/* 排水勾配 */}
      <h4 style={{ margin: "12px 0 4px", fontSize: 13 }}>排水勾配チェック</h4>
      {slopeResults.length === 0 ? (
        <div style={{ color: "#999" }}>排水系ルートなし</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <th style={thStyle}>設備</th>
              <th style={thStyle}>管種</th>
              <th style={thStyle}>横引(mm)</th>
              <th style={thStyle}>高低差(mm)</th>
              <th style={thStyle}>許容(mm)</th>
              <th style={thStyle}>判定</th>
            </tr>
          </thead>
          <tbody>
            {slopeResults.map((r, i) => {
              const fixture = fixtures.find((f) => f.id === r.fixtureId);
              return (
                <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={tdStyle}>
                    {fixture ? fixtureLabels[fixture.type] : "?"}
                  </td>
                  <td style={tdStyle}>{pipeTypeLabels[r.pipeType]}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {r.lengthMm}
                  </td>
                  <td style={{
                    ...tdStyle,
                    textAlign: "right",
                    color: r.requiredDropMm > r.allowableDropMm ? "#f44336" : undefined,
                    fontWeight: r.requiredDropMm > r.allowableDropMm ? 600 : undefined,
                  }}>
                    {r.requiredDropMm.toFixed(1)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {r.allowableDropMm}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span
                      style={{
                        color: "#fff",
                        background: statusColor[r.status],
                        padding: "1px 6px",
                        borderRadius: 3,
                        fontSize: 11,
                      }}
                    >
                      {statusLabel[r.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* PS寸法 */}
      <h4 style={{ margin: "12px 0 4px", fontSize: 13 }}>PS寸法チェック</h4>
      {psResults.length === 0 ? (
        <div style={{ color: "#999" }}>PS未配置</div>
      ) : (
        psResults.map((pr) => {
          const ps = fixtures.find((f) => f.id === pr.psId);
          return (
            <div
              key={pr.psId}
              style={{
                border: `1px solid ${statusColor[pr.status]}`,
                borderRadius: 4,
                padding: 8,
                marginBottom: 6,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                PS ({ps?.w}×{ps?.h}mm){" "}
                <span
                  style={{
                    color: "#fff",
                    background: statusColor[pr.status],
                    padding: "1px 6px",
                    borderRadius: 3,
                    fontSize: 11,
                  }}
                >
                  {statusLabel[pr.status]}
                </span>
              </div>
              <div>最小必要: {pr.requiredWidthMm}×{pr.requiredDepthMm}mm</div>
              <div>推奨: {pr.recommendedWidthMm}×{pr.recommendedDepthMm}mm</div>
            </div>
          );
        })
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "2px 4px",
  fontSize: 11,
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "2px 4px",
  fontSize: 11,
};
