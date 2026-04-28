import type { FixtureType } from "../domain/types";
import { fixtureLabels, fixtureColors } from "../domain/rules/fixtureDefaults";

const equipmentTypes: FixtureType[] = [
  "toilet",
  "ub",
  "washbasin",
  "washing",
  "kitchen",
  "ps",
];

const structuralTypes: FixtureType[] = ["column", "beam", "wall"];

type Props = {
  onSelect: (type: FixtureType) => void;
  selectedType: FixtureType | null;
};

function PaletteButton({
  type,
  selected,
  onSelect,
}: {
  type: FixtureType;
  selected: boolean;
  onSelect: (t: FixtureType) => void;
}) {
  const isStructural = type === "column" || type === "beam" || type === "wall";
  const bg = selected
    ? fixtureColors[type] === "transparent"
      ? "#fafafa"
      : fixtureColors[type]
    : "#f5f5f5";

  return (
    <button
      onClick={() => onSelect(type)}
      style={{
        padding: "8px 12px",
        cursor: "pointer",
        background: bg,
        border: selected ? "2px solid #333" : "1px solid #ccc",
        borderRadius: 4,
        fontSize: 13,
        textAlign: "left",
        fontWeight: selected ? 600 : 400,
        // 梁ボタンは破線縁取りで視覚的に分かるように
        ...(type === "beam" && !selected
          ? { borderStyle: "dashed" }
          : {}),
        color: isStructural && type === "column" ? "#fff" : undefined,
      }}
    >
      {fixtureLabels[type]}
    </button>
  );
}

export function FixturePalette({ onSelect, selectedType }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>設備パレット</h3>
      {equipmentTypes.map((type) => (
        <PaletteButton
          key={type}
          type={type}
          selected={selectedType === type}
          onSelect={onSelect}
        />
      ))}

      <h3 style={{ margin: "12px 0 4px", fontSize: 14 }}>構造・図面参照</h3>
      {structuralTypes.map((type) => (
        <PaletteButton
          key={type}
          type={type}
          selected={selectedType === type}
          onSelect={onSelect}
        />
      ))}

      <div style={{ marginTop: 8, fontSize: 11, color: "#888" }}>
        パレットで選択後、
        <br />
        グリッドをクリックで配置
      </div>
    </div>
  );
}
