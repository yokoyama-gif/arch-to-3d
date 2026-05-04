/**
 * 表示レイヤーの ON/OFF パネル。
 * 電気図面CAD風の「レイヤ表示切替」を模した小型パネル。
 *
 * 各レイヤーは「実際にレンダリングをスキップする」ためのトグル。
 * 該当レイヤーがオフの間は対応する要素が非表示になる。
 */
export type LayerVisibility = {
  background: boolean;
  fixtures: boolean;
  pipes: boolean;
  drains: boolean;
  markers: boolean;
  grid: boolean;
};

type Props = {
  visibility: LayerVisibility;
  onChange: (patch: Partial<LayerVisibility>) => void;
};

const LAYERS: Array<{
  key: keyof LayerVisibility;
  label: string;
  color: string;
}> = [
  { key: "background", label: "背景平面図", color: "#9e9e9e" },
  { key: "grid", label: "グリッド", color: "#7aa9d6" },
  { key: "fixtures", label: "設備", color: "#bbdefb" },
  { key: "pipes", label: "配管", color: "#1565c0" },
  { key: "drains", label: "排水溝", color: "#1e88e5" },
  { key: "markers", label: "柱マーク", color: "#e53935" },
];

export function LayerPanel({ visibility, onChange }: Props) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #c0c0c0",
        borderRadius: 2,
        padding: 4,
        fontSize: 11,
      }}
    >
      <div
        style={{
          background: "linear-gradient(180deg, #4a5360 0%, #353c47 100%)",
          color: "#fff",
          padding: "2px 6px",
          margin: "-4px -4px 4px",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.5,
          borderRadius: "1px 1px 0 0",
        }}
      >
        表示レイヤー
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {LAYERS.map(({ key, label, color }) => (
            <tr key={key}>
              <td style={{ padding: "1px 2px", width: 18 }}>
                <input
                  type="checkbox"
                  checked={visibility[key]}
                  onChange={() => onChange({ [key]: !visibility[key] })}
                  style={{ margin: 0 }}
                />
              </td>
              <td style={{ padding: "1px 4px", width: 14 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    background: color,
                    border: "1px solid #888",
                  }}
                />
              </td>
              <td
                style={{
                  padding: "1px 2px",
                  cursor: "pointer",
                  color: visibility[key] ? "#222" : "#999",
                }}
                onClick={() => onChange({ [key]: !visibility[key] })}
              >
                {label}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
