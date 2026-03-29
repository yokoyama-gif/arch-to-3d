import type { BuildingSettings, Fixture } from "../domain/types";
import { fixtureLabels } from "../domain/rules/fixtureDefaults";
import { presets } from "../domain/rules/presets";
import { NumberInput } from "./NumberInput";

type Props = {
  buildingSettings: BuildingSettings;
  onUpdateSettings: (s: Partial<BuildingSettings>) => void;
  selectedFixture: Fixture | null;
  onResize: (id: string, w: number, h: number) => void;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
};

export function PropertyPanel({
  buildingSettings,
  onUpdateSettings,
  selectedFixture,
  onResize,
  onRotate,
  onDelete,
}: Props) {
  const s = buildingSettings;

  return (
    <div style={{ fontSize: 13 }}>
      {/* プリセット */}
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>プリセット</h3>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
        {presets.map((p) => (
          <button
            key={p.name}
            style={{ fontSize: 11, padding: "4px 8px", cursor: "pointer" }}
            onClick={() => onUpdateSettings(p.buildingSettings)}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* 建物設定 */}
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>建物条件</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px" }}>
        <label>階数</label>
        <NumberInput
          value={s.floors}
          min={1}
          max={10}
          step={1}
          onChange={(v) => onUpdateSettings({ floors: v })}
          style={inputStyle}
        />

        <label>住戸数</label>
        <NumberInput
          value={s.unitCount}
          min={1}
          step={1}
          onChange={(v) => onUpdateSettings({ unitCount: v })}
          style={inputStyle}
        />

        <label>廊下タイプ</label>
        <select
          value={s.corridorType}
          onChange={(e) =>
            onUpdateSettings({
              corridorType: e.target.value as "single" | "double",
            })
          }
          style={inputStyle}
        >
          <option value="single">片廊下</option>
          <option value="double">中廊下</option>
        </select>

        <label>構造種別</label>
        <select
          value={s.structureType}
          onChange={(e) =>
            onUpdateSettings({
              structureType: e.target.value as "wood" | "rc" | "steel",
            })
          }
          style={inputStyle}
        >
          <option value="wood">木造</option>
          <option value="rc">RC</option>
          <option value="steel">鉄骨</option>
        </select>

        <label>天井懐(mm)</label>
        <NumberInput
          value={s.ceilingPlenumMm}
          step={10}
          min={0}
          onChange={(v) => onUpdateSettings({ ceilingPlenumMm: v })}
          style={inputStyle}
        />

        <label>床段差許容(mm)</label>
        <NumberInput
          value={s.floorStepAllowanceMm}
          step={10}
          min={0}
          onChange={(v) => onUpdateSettings({ floorStepAllowanceMm: v })}
          style={inputStyle}
        />

        <label>グリッド(mm)</label>
        <NumberInput
          value={s.gridSizeMm}
          step={50}
          min={50}
          onChange={(v) => onUpdateSettings({ gridSizeMm: v })}
          style={inputStyle}
        />
      </div>

      {/* 選択設備詳細 */}
      {selectedFixture && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>選択設備</h3>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 8px", fontSize: 12, alignItems: "center" }}>
            <label>種別</label>
            <div>{fixtureLabels[selectedFixture.type]}</div>

            <label>位置</label>
            <div>({selectedFixture.x}, {selectedFixture.y})</div>

            <label>幅(mm)</label>
            <NumberInput
              key={`w-${selectedFixture.id}`}
              value={selectedFixture.w}
              step={50}
              min={100}
              onChange={(v) =>
                onResize(selectedFixture.id, v, selectedFixture.h)
              }
              style={inputStyle}
            />

            <label>奥行(mm)</label>
            <NumberInput
              key={`h-${selectedFixture.id}`}
              value={selectedFixture.h}
              step={50}
              min={100}
              onChange={(v) =>
                onResize(selectedFixture.id, selectedFixture.w, v)
              }
              style={inputStyle}
            />

            <label>回転</label>
            <div>{selectedFixture.rotation}°</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={() => onRotate(selectedFixture.id)}
              style={{ padding: "4px 12px", cursor: "pointer" }}
            >
              回転
            </button>
            <button
              onClick={() => onDelete(selectedFixture.id)}
              style={{
                padding: "4px 12px",
                cursor: "pointer",
                background: "#ffcdd2",
              }}
            >
              削除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "2px 4px",
  fontSize: 12,
  boxSizing: "border-box",
};
