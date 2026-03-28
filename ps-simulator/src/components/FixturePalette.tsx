import type { FixtureType } from "../domain/types";
import { fixtureLabels, fixtureColors } from "../domain/rules/fixtureDefaults";

const fixtureTypes: FixtureType[] = [
  "toilet",
  "ub",
  "washbasin",
  "washing",
  "kitchen",
  "ps",
];

type Props = {
  onSelect: (type: FixtureType) => void;
  selectedType: FixtureType | null;
};

export function FixturePalette({ onSelect, selectedType }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>設備パレット</h3>
      {fixtureTypes.map((type) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          style={{
            padding: "8px 12px",
            cursor: "pointer",
            background:
              selectedType === type ? fixtureColors[type] : "#f5f5f5",
            border:
              selectedType === type
                ? `2px solid #333`
                : "1px solid #ccc",
            borderRadius: 4,
            fontSize: 13,
            textAlign: "left",
            fontWeight: selectedType === type ? 600 : 400,
          }}
        >
          {fixtureLabels[type]}
        </button>
      ))}
      <div style={{ marginTop: 8, fontSize: 11, color: "#888" }}>
        パレットで選択後、
        <br />
        グリッドをクリックで配置
      </div>
    </div>
  );
}
