import type { PipeDiameters, PipeType } from "../domain/types";
import { pipeTypeLabels, pipeColors } from "../domain/rules/pipeSpecs";
import { NumberInput } from "./NumberInput";

type Props = {
  pipeDiameters: PipeDiameters;
  onChange: (
    pipeType: PipeType,
    kind: "horizontal" | "riser",
    valueMm: number
  ) => void;
};

const ALL_PIPE_TYPES: PipeType[] = [
  "soil",
  "waste",
  "vent",
  "cold",
  "hot",
  "gas",
];

/**
 * 各管種の横管・竪管φ(mm)を一覧編集するパネル。
 * 変更すると即座に図面の線幅と竪管マーカー径に反映される。
 */
export function PipeDiameterPanel({ pipeDiameters, onChange }: Props) {
  return (
    <div style={{ fontSize: 12 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>配管径(φ mm)</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #ddd" }}>
            <th style={thStyle}></th>
            <th style={thStyle}>管種</th>
            <th style={thStyle}>横管</th>
            <th style={thStyle}>竪管</th>
          </tr>
        </thead>
        <tbody>
          {ALL_PIPE_TYPES.map((pt) => {
            const d = pipeDiameters[pt];
            return (
              <tr key={pt} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={tdStyle}>
                  {/* 色の凡例 */}
                  <span
                    style={{
                      display: "inline-block",
                      width: 12,
                      height: 12,
                      background: pipeColors[pt],
                      borderRadius: 2,
                      verticalAlign: "middle",
                    }}
                  />
                </td>
                <td style={tdStyle}>{pipeTypeLabels[pt]}</td>
                <td style={tdStyle}>
                  <NumberInput
                    value={d.horizontalMm}
                    min={10}
                    max={300}
                    step={5}
                    onChange={(v) => onChange(pt, "horizontal", v)}
                    style={inputStyle}
                  />
                </td>
                <td style={tdStyle}>
                  <NumberInput
                    value={d.riserMm}
                    min={10}
                    max={300}
                    step={5}
                    onChange={(v) => onChange(pt, "riser", v)}
                    style={inputStyle}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
  padding: "3px 4px",
  fontSize: 11,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "1px 4px",
  fontSize: 11,
  boxSizing: "border-box",
};
