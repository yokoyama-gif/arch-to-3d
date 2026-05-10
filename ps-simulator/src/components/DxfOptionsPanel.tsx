import type { DxfExportOptions, DxfExportMode } from "../utils/exportDxf";

type Props = {
  options: DxfExportOptions;
  onChange: (patch: Partial<DxfExportOptions>) => void;
  onExport: () => void;
};

const MODES: Array<{ value: DxfExportMode; label: string; hint: string }> = [
  { value: "all", label: "全部", hint: "設備+構造+配管+背景+グリッド" },
  { value: "equipmentAndPipes", label: "設備+配管", hint: "構造・背景なし" },
  { value: "pipesOnly", label: "配管のみ", hint: "ルート線だけ" },
];

/**
 * DXF出力オプションパネル。
 * 出力モード選択 + グリッド/背景/ラベル のチェックボックス。
 */
export function DxfOptionsPanel({ options, onChange, onExport }: Props) {
  return (
    <div style={{ fontSize: 12 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>DXF出力</h3>
      <div
        style={{
          padding: 6,
          background: "#fff",
          border: "1px solid #c0c0c0",
          borderRadius: 2,
        }}
      >
        <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 11, color: "#444" }}>
          出力モード
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {MODES.map((m) => (
            <label
              key={m.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="dxf-mode"
                checked={options.mode === m.value}
                onChange={() => onChange({ mode: m.value })}
              />
              <span style={{ minWidth: 78 }}>{m.label}</span>
              <span style={{ color: "#888", fontSize: 10 }}>{m.hint}</span>
            </label>
          ))}
        </div>

        <div
          style={{ marginTop: 8, fontWeight: 600, fontSize: 11, color: "#444" }}
        >
          含める要素
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={options.includeGrid}
              onChange={(e) => onChange({ includeGrid: e.target.checked })}
              disabled={options.mode !== "all"}
            />
            グリッド線（modeがallの時のみ）
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={options.includeBackground}
              onChange={(e) => onChange({ includeBackground: e.target.checked })}
              disabled={options.mode !== "all"}
            />
            背景平面図 外枠/マーカー
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={options.includeLabels}
              onChange={(e) => onChange({ includeLabels: e.target.checked })}
            />
            ラベル(設備名・管種名)
          </label>
        </div>

        <button
          onClick={onExport}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "5px 0",
            cursor: "pointer",
            background: "#1976d2",
            color: "#fff",
            border: "none",
            borderRadius: 2,
            fontWeight: 600,
          }}
        >
          DXF を保存
        </button>

        <div style={{ marginTop: 6, fontSize: 10, color: "#888", lineHeight: 1.4 }}>
          AutoCAD R12 (AC1009) ASCII。Jw_cad / DraftSight でも開けます。単位 mm。
        </div>
      </div>
    </div>
  );
}
