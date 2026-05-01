import type {
  BuildingSettings,
  Fixture,
  ModuleMm,
  GridDivision,
} from "../domain/types";
import {
  MODULE_OPTIONS,
  GRID_DIVISION_OPTIONS,
} from "../domain/types";
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

      {/* 建物設定（必要最小限の項目のみ表示） */}
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>建物条件</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px" }}>
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

        <label>床段差許容(mm)</label>
        <NumberInput
          value={s.floorStepAllowanceMm}
          step={10}
          min={0}
          onChange={(v) => onUpdateSettings({ floorStepAllowanceMm: v })}
          style={inputStyle}
        />

        <label>モジュール(mm)</label>
        <select
          value={s.moduleMm}
          onChange={(e) =>
            onUpdateSettings({ moduleMm: Number(e.target.value) as ModuleMm })
          }
          style={inputStyle}
        >
          {MODULE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <label>分割数</label>
        <select
          value={s.gridDivision}
          onChange={(e) =>
            onUpdateSettings({
              gridDivision: Number(e.target.value) as GridDivision,
            })
          }
          style={inputStyle}
        >
          {GRID_DIVISION_OPTIONS.map((d) => (
            <option key={d} value={d}>
              1/{d}
            </option>
          ))}
        </select>

        <label>グリッド寸法</label>
        <div style={{ fontSize: 12, padding: "2px 4px", color: "#555" }}>
          {s.gridSizeMm} mm（{s.moduleMm} ÷ {s.gridDivision}）
        </div>
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
