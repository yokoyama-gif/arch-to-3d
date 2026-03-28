import type { BuildingSettings, Fixture } from "../domain/types";
import { fixtureLabels } from "../domain/rules/fixtureDefaults";
import { presets } from "../domain/rules/presets";

type Props = {
  buildingSettings: BuildingSettings;
  onUpdateSettings: (s: Partial<BuildingSettings>) => void;
  selectedFixture: Fixture | null;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
};

export function PropertyPanel({
  buildingSettings,
  onUpdateSettings,
  selectedFixture,
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
        <input
          type="number"
          value={s.floors}
          min={1}
          max={10}
          onChange={(e) => onUpdateSettings({ floors: Number(e.target.value) })}
          style={inputStyle}
        />

        <label>住戸数</label>
        <input
          type="number"
          value={s.unitCount}
          min={1}
          onChange={(e) => onUpdateSettings({ unitCount: Number(e.target.value) })}
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
        <input
          type="number"
          value={s.ceilingPlenumMm}
          step={10}
          onChange={(e) =>
            onUpdateSettings({ ceilingPlenumMm: Number(e.target.value) })
          }
          style={inputStyle}
        />

        <label>床段差許容(mm)</label>
        <input
          type="number"
          value={s.floorStepAllowanceMm}
          step={10}
          onChange={(e) =>
            onUpdateSettings({ floorStepAllowanceMm: Number(e.target.value) })
          }
          style={inputStyle}
        />

        <label>グリッド(mm)</label>
        <input
          type="number"
          value={s.gridSizeMm}
          step={50}
          min={50}
          onChange={(e) =>
            onUpdateSettings({ gridSizeMm: Number(e.target.value) })
          }
          style={inputStyle}
        />
      </div>

      {/* 選択設備詳細 */}
      {selectedFixture && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>選択設備</h3>
          <table style={{ fontSize: 12, width: "100%" }}>
            <tbody>
              <tr>
                <td>種別</td>
                <td>{fixtureLabels[selectedFixture.type]}</td>
              </tr>
              <tr>
                <td>位置</td>
                <td>
                  ({selectedFixture.x}, {selectedFixture.y})
                </td>
              </tr>
              <tr>
                <td>寸法</td>
                <td>
                  {selectedFixture.w} × {selectedFixture.h} mm
                </td>
              </tr>
              <tr>
                <td>回転</td>
                <td>{selectedFixture.rotation}°</td>
              </tr>
            </tbody>
          </table>
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
