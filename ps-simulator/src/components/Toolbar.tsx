type Props = {
  planName: string;
  onPlanNameChange: (name: string) => void;
  onSave: () => void;
  onExport: () => void;
  onImport: () => void;
};

export function Toolbar({
  planName,
  onPlanNameChange,
  onSave,
  onExport,
  onImport,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: "#f5f5f5",
        borderBottom: "1px solid #ddd",
        fontSize: 13,
      }}
    >
      <strong style={{ marginRight: 8 }}>PS Simulator</strong>
      <label>案名:</label>
      <input
        value={planName}
        onChange={(e) => onPlanNameChange(e.target.value)}
        style={{ padding: "2px 6px", width: 160, fontSize: 12 }}
      />
      <button onClick={onSave} style={btnStyle}>
        案を保存
      </button>
      <div style={{ flex: 1 }} />
      <button onClick={onExport} style={btnStyle}>
        JSON出力
      </button>
      <button onClick={onImport} style={btnStyle}>
        JSON読込
      </button>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "4px 12px",
  cursor: "pointer",
  fontSize: 12,
};
