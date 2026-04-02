import React, { useState } from 'react';
import { useStore, getAllPresets } from '../store/useStore';
import { defaultBoxPresets, equipmentPresets, doorPresets, objectColors } from '../data/presets';
import { BoxPreset } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const ObjectPanel: React.FC = () => {
  const { setPlacingPreset, setPlacingEquipment, placingPreset, placingEquipment, project, addUserPreset, deleteUserPreset } = useStore();
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customPreset, setCustomPreset] = useState<Partial<BoxPreset>>({
    name: '', width: 500, depth: 400, height: 800, frontSpace: 600, maintenanceSpace: 100,
    hasAnchor: true, mountType: 'wall', unitType: 'single', hasMailIntegration: false, category: 'medium',
  });

  const allPresets = getAllPresets(project.userPresets);

  const handleAddCustom = () => {
    if (!customPreset.name) return;
    addUserPreset({
      ...customPreset as BoxPreset,
      id: uuidv4(),
      isUserDefined: true,
    });
    setShowCustomForm(false);
    setCustomPreset({ name: '', width: 500, depth: 400, height: 800, frontSpace: 600, maintenanceSpace: 100, hasAnchor: true, mountType: 'wall', unitType: 'single', hasMailIntegration: false, category: 'medium' });
  };

  const categoryLabels: Record<string, string> = {
    small: '小型', medium: '中型', large: '大型',
    mail_integrated: 'メール一体型', slim: '薄型', large_freestanding: '据置大型',
  };

  return (
    <div style={styles.panel}>
      <h3 style={styles.heading}>宅配ボックス</h3>
      <div style={styles.section}>
        {allPresets.map((preset) => (
          <div
            key={preset.id}
            style={{
              ...styles.item,
              background: placingPreset?.id === preset.id ? '#e3f2fd' : '#fff',
              borderColor: placingPreset?.id === preset.id ? '#4A90D9' : '#ddd',
            }}
            onClick={() =>
              placingPreset?.id === preset.id ? setPlacingPreset(null) : setPlacingPreset(preset)
            }
          >
            <div style={{ ...styles.colorDot, background: objectColors.delivery_box }} />
            <div style={styles.itemContent}>
              <div style={styles.itemName}>{preset.name}</div>
              <div style={styles.itemSize}>
                {preset.width}×{preset.depth}×{preset.height}mm
                <span style={styles.badge}>{categoryLabels[preset.category] || preset.category}</span>
              </div>
            </div>
            {preset.isUserDefined && (
              <button
                style={styles.deleteBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteUserPreset(preset.id);
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button style={styles.addBtn} onClick={() => setShowCustomForm(!showCustomForm)}>
          ＋ カスタム寸法を登録
        </button>
        {showCustomForm && (
          <div style={styles.customForm}>
            <input style={styles.input} placeholder="名前" value={customPreset.name || ''} onChange={(e) => setCustomPreset({ ...customPreset, name: e.target.value })} />
            <div style={styles.row}>
              <label style={styles.label}>幅<input style={styles.numInput} type="number" value={customPreset.width} onChange={(e) => setCustomPreset({ ...customPreset, width: +e.target.value })} />mm</label>
              <label style={styles.label}>奥行<input style={styles.numInput} type="number" value={customPreset.depth} onChange={(e) => setCustomPreset({ ...customPreset, depth: +e.target.value })} />mm</label>
              <label style={styles.label}>高さ<input style={styles.numInput} type="number" value={customPreset.height} onChange={(e) => setCustomPreset({ ...customPreset, height: +e.target.value })} />mm</label>
            </div>
            <div style={styles.row}>
              <label style={styles.label}>前面<input style={styles.numInput} type="number" value={customPreset.frontSpace} onChange={(e) => setCustomPreset({ ...customPreset, frontSpace: +e.target.value })} />mm</label>
              <label style={styles.label}>
                <select value={customPreset.mountType} onChange={(e) => setCustomPreset({ ...customPreset, mountType: e.target.value as any })}>
                  <option value="wall">壁付け</option>
                  <option value="freestanding">独立置き</option>
                </select>
              </label>
            </div>
            <div style={styles.row}>
              <label><input type="checkbox" checked={customPreset.hasMailIntegration} onChange={(e) => setCustomPreset({ ...customPreset, hasMailIntegration: e.target.checked })} /> メール一体型</label>
            </div>
            <button style={styles.confirmBtn} onClick={handleAddCustom}>登録</button>
          </div>
        )}
      </div>

      <h3 style={styles.heading}>設備</h3>
      <div style={styles.section}>
        {equipmentPresets.map((eq) => (
          <div
            key={eq.type}
            style={{
              ...styles.item,
              background: placingEquipment?.type === eq.type ? '#e3f2fd' : '#fff',
              borderColor: placingEquipment?.type === eq.type ? '#4A90D9' : '#ddd',
            }}
            onClick={() =>
              placingEquipment?.type === eq.type
                ? setPlacingEquipment(null)
                : setPlacingEquipment(eq)
            }
          >
            <div style={{ ...styles.colorDot, background: objectColors[eq.type] || '#999' }} />
            <div style={styles.itemContent}>
              <div style={styles.itemName}>{eq.name}</div>
              <div style={styles.itemSize}>{eq.width}×{eq.depth}mm</div>
            </div>
          </div>
        ))}
      </div>

      <h3 style={styles.heading}>扉</h3>
      <div style={styles.section}>
        {doorPresets.map((door) => (
          <div
            key={door.name}
            style={{
              ...styles.item,
              background: placingEquipment?.name === door.name ? '#e3f2fd' : '#fff',
              borderColor: placingEquipment?.name === door.name ? '#4A90D9' : '#ddd',
            }}
            onClick={() =>
              placingEquipment?.name === door.name
                ? setPlacingEquipment(null)
                : setPlacingEquipment({
                    type: 'door',
                    name: door.name,
                    width: door.width,
                    depth: door.depth,
                    doorType: door.doorType,
                    doorSwing: 'right',
                    doorWidth: door.doorWidth,
                  })
            }
          >
            <div style={{ ...styles.colorDot, background: objectColors.door }} />
            <div style={styles.itemContent}>
              <div style={styles.itemName}>{door.name}</div>
              <div style={styles.itemSize}>{door.width}×{door.depth}mm</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: { width: 260, background: '#fff', borderRight: '1px solid #e0e0e0', overflowY: 'auto', padding: '8px 0' },
  heading: { fontSize: 13, fontWeight: 700, color: '#555', padding: '8px 12px 4px', margin: 0, borderBottom: '1px solid #eee' },
  section: { padding: '4px 8px' },
  item: { display: 'flex', alignItems: 'center', padding: '6px 8px', marginBottom: 4, borderRadius: 6, border: '1.5px solid #ddd', cursor: 'pointer', fontSize: 12, transition: 'all 0.15s' },
  colorDot: { width: 10, height: 10, borderRadius: '50%', marginRight: 8, flexShrink: 0 },
  itemContent: { flex: 1, minWidth: 0 },
  itemName: { fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemSize: { fontSize: 10, color: '#888', marginTop: 1 },
  badge: { display: 'inline-block', background: '#e8e8e8', borderRadius: 3, padding: '0 4px', marginLeft: 4, fontSize: 9 },
  deleteBtn: { background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: 16, padding: '0 4px' },
  addBtn: { width: '100%', padding: '6px', background: '#f5f5f5', border: '1px dashed #ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#666', marginTop: 4 },
  customForm: { padding: 8, background: '#f9f9f9', borderRadius: 6, marginTop: 4 },
  input: { width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12, marginBottom: 4, boxSizing: 'border-box' },
  row: { display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap', fontSize: 11 },
  label: { fontSize: 11, color: '#666' },
  numInput: { width: 50, padding: '2px 4px', border: '1px solid #ccc', borderRadius: 3, fontSize: 11, margin: '0 2px' },
  confirmBtn: { width: '100%', padding: 6, background: '#4A90D9', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 },
};
