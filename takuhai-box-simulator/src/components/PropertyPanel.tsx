import React from 'react';
import { useStore } from '../store/useStore';
import { DoorSwingDirection, DoorType } from '../types';

export const PropertyPanel: React.FC = () => {
  const { selectedObjectId, updateObject, deleteObject, canvas, setCanvas, updateRoom, updateSettings } = useStore();
  const plan = useStore((s) => s.activePlan());
  const selectedObj = plan.objects.find((o) => o.id === selectedObjectId);

  return (
    <div style={styles.panel}>
      {selectedObj ? (
        <>
          <h3 style={styles.heading}>選択中: {selectedObj.name}</h3>
          <div style={styles.section}>
            <label style={styles.label}>名前</label>
            <input
              style={styles.input}
              value={selectedObj.name}
              onChange={(e) => updateObject(selectedObj.id, { name: e.target.value })}
            />

            <div style={styles.row}>
              <div>
                <label style={styles.label}>X (mm)</label>
                <input style={styles.numInput} type="number" value={Math.round(selectedObj.x)}
                  onChange={(e) => updateObject(selectedObj.id, { x: +e.target.value })} />
              </div>
              <div>
                <label style={styles.label}>Y (mm)</label>
                <input style={styles.numInput} type="number" value={Math.round(selectedObj.y)}
                  onChange={(e) => updateObject(selectedObj.id, { y: +e.target.value })} />
              </div>
            </div>

            <div style={styles.row}>
              <div>
                <label style={styles.label}>幅 (mm)</label>
                <input style={styles.numInput} type="number" value={selectedObj.width}
                  onChange={(e) => updateObject(selectedObj.id, { width: +e.target.value })} />
              </div>
              <div>
                <label style={styles.label}>奥行 (mm)</label>
                <input style={styles.numInput} type="number" value={selectedObj.depth}
                  onChange={(e) => updateObject(selectedObj.id, { depth: +e.target.value })} />
              </div>
            </div>

            <label style={styles.label}>回転</label>
            <select style={styles.select} value={selectedObj.rotation}
              onChange={(e) => updateObject(selectedObj.id, { rotation: +e.target.value as any })}>
              <option value={0}>0°</option>
              <option value={90}>90°</option>
              <option value={180}>180°</option>
              <option value={270}>270°</option>
            </select>

            {selectedObj.type === 'door' && (
              <>
                <label style={styles.label}>扉の種類</label>
                <select style={styles.select} value={selectedObj.doorType || 'single'}
                  onChange={(e) => updateObject(selectedObj.id, { doorType: e.target.value as DoorType })}>
                  <option value="single">片開き</option>
                  <option value="double">両開き</option>
                  <option value="sliding">引き戸</option>
                  <option value="auto">自動ドア</option>
                </select>

                <label style={styles.label}>開閉方向</label>
                <select style={styles.select} value={selectedObj.doorSwing || 'right'}
                  onChange={(e) => updateObject(selectedObj.id, { doorSwing: e.target.value as DoorSwingDirection })}>
                  <option value="left">左開き</option>
                  <option value="right">右開き</option>
                  <option value="both">両方</option>
                </select>

                <label style={styles.label}>扉幅 (mm)</label>
                <input style={styles.numInput} type="number" value={selectedObj.doorWidth || 800}
                  onChange={(e) => updateObject(selectedObj.id, { doorWidth: +e.target.value })} />
              </>
            )}

            {selectedObj.type === 'delivery_box' && (
              <>
                <label style={styles.label}>前面操作スペース (mm)</label>
                <input style={styles.numInput} type="number" value={selectedObj.frontSpace || 600}
                  onChange={(e) => updateObject(selectedObj.id, { frontSpace: +e.target.value })} />

                <label style={styles.label}>設置方式</label>
                <select style={styles.select} value={selectedObj.mountType || 'wall'}
                  onChange={(e) => updateObject(selectedObj.id, { mountType: e.target.value as any })}>
                  <option value="wall">壁付け</option>
                  <option value="freestanding">独立置き</option>
                </select>
              </>
            )}

            <div style={{ ...styles.row, marginTop: 8 }}>
              <button style={styles.actionBtn} onClick={() => {
                const store = useStore.getState();
                store.duplicateObject(selectedObj.id);
              }}>複製</button>
              <button style={{ ...styles.actionBtn, background: '#f44336' }}
                onClick={() => deleteObject(selectedObj.id)}>削除</button>
            </div>
          </div>

          {/* Judgments for selected object */}
          {plan.judgments.filter((j) => j.objectId === selectedObj.id).length > 0 && (
            <>
              <h3 style={styles.heading}>判定結果</h3>
              <div style={styles.section}>
                {plan.judgments
                  .filter((j) => j.objectId === selectedObj.id)
                  .map((j) => (
                    <div key={j.id} style={{
                      ...styles.judgment,
                      borderLeft: `4px solid ${j.level === 'ng' ? '#F44336' : j.level === 'warning' ? '#FFC107' : '#4CAF50'}`,
                    }}>
                      <span style={{ fontWeight: 700, color: j.level === 'ng' ? '#F44336' : j.level === 'warning' ? '#FFC107' : '#4CAF50' }}>
                        {j.level === 'ng' ? 'NG' : j.level === 'warning' ? '注意' : 'OK'}
                      </span>{' '}
                      {j.message}
                    </div>
                  ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <h3 style={styles.heading}>空間設定</h3>
          <div style={styles.section}>
            <label style={styles.label}>空間名</label>
            <input style={styles.input} value={plan.room.name}
              onChange={(e) => updateRoom({ name: e.target.value })} />

            <div style={styles.row}>
              <div>
                <label style={styles.label}>幅 (mm)</label>
                <input style={styles.numInput} type="number" value={plan.room.width}
                  onChange={(e) => updateRoom({ width: +e.target.value })} />
              </div>
              <div>
                <label style={styles.label}>奥行 (mm)</label>
                <input style={styles.numInput} type="number" value={plan.room.depth}
                  onChange={(e) => updateRoom({ depth: +e.target.value })} />
              </div>
            </div>
          </div>

          <h3 style={styles.heading}>判定基準</h3>
          <div style={styles.section}>
            <label style={styles.label}>最低通路幅 (mm)</label>
            <input style={styles.numInput} type="number" value={plan.settings.minCorridorWidth}
              onChange={(e) => updateSettings({ minCorridorWidth: +e.target.value })} />
            <label style={styles.label}>推奨通路幅 (mm)</label>
            <input style={styles.numInput} type="number" value={plan.settings.recommendedCorridorWidth}
              onChange={(e) => updateSettings({ recommendedCorridorWidth: +e.target.value })} />
            <label style={styles.label}>前面操作スペース (mm)</label>
            <input style={styles.numInput} type="number" value={plan.settings.frontOperationSpace}
              onChange={(e) => updateSettings({ frontOperationSpace: +e.target.value })} />
            <label style={styles.label}>扉前余裕 (mm)</label>
            <input style={styles.numInput} type="number" value={plan.settings.doorClearance}
              onChange={(e) => updateSettings({ doorClearance: +e.target.value })} />
            <label style={styles.label}>出入口前スペース (mm)</label>
            <input style={styles.numInput} type="number" value={plan.settings.entranceClearance}
              onChange={(e) => updateSettings({ entranceClearance: +e.target.value })} />
          </div>

          <h3 style={styles.heading}>表示設定</h3>
          <div style={styles.section}>
            <label style={styles.checkLabel}>
              <input type="checkbox" checked={canvas.showDimensions} onChange={(e) => setCanvas({ showDimensions: e.target.checked })} /> 寸法表示
            </label>
            <label style={styles.checkLabel}>
              <input type="checkbox" checked={canvas.showJudgments} onChange={(e) => setCanvas({ showJudgments: e.target.checked })} /> 判定表示
            </label>
            <label style={styles.checkLabel}>
              <input type="checkbox" checked={canvas.showOperationSpace} onChange={(e) => setCanvas({ showOperationSpace: e.target.checked })} /> 操作スペース表示
            </label>
            <label style={styles.checkLabel}>
              <input type="checkbox" checked={canvas.showDoorSwing} onChange={(e) => setCanvas({ showDoorSwing: e.target.checked })} /> 扉開閉範囲表示
            </label>
            <label style={styles.checkLabel}>
              <input type="checkbox" checked={canvas.snapToGrid} onChange={(e) => setCanvas({ snapToGrid: e.target.checked })} /> グリッドスナップ
            </label>
            <div>
              <label style={styles.label}>グリッド間隔 (mm)</label>
              <input style={styles.numInput} type="number" value={canvas.gridSize}
                onChange={(e) => setCanvas({ gridSize: Math.max(10, +e.target.value) })} />
            </div>
          </div>

          {/* All judgments */}
          {plan.judgments.length > 0 && (
            <>
              <h3 style={styles.heading}>全体判定結果</h3>
              <div style={styles.section}>
                <div style={styles.judgmentSummary}>
                  <span style={{ color: '#F44336', fontWeight: 700 }}>
                    NG: {plan.judgments.filter((j) => j.level === 'ng').length}
                  </span>
                  {' '}
                  <span style={{ color: '#FFC107', fontWeight: 700 }}>
                    注意: {plan.judgments.filter((j) => j.level === 'warning').length}
                  </span>
                </div>
                {plan.judgments.map((j) => (
                  <div key={j.id} style={{
                    ...styles.judgment,
                    borderLeft: `4px solid ${j.level === 'ng' ? '#F44336' : j.level === 'warning' ? '#FFC107' : '#4CAF50'}`,
                    cursor: 'pointer',
                  }}
                    onClick={() => useStore.getState().setSelectedObject(j.objectId)}>
                    <span style={{ fontWeight: 700, color: j.level === 'ng' ? '#F44336' : '#FFC107' }}>
                      {j.level === 'ng' ? 'NG' : '注意'}
                    </span>{' '}
                    {j.message}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: { width: 280, background: '#fff', borderLeft: '1px solid #e0e0e0', overflowY: 'auto', padding: '0' },
  heading: { fontSize: 13, fontWeight: 700, color: '#555', padding: '8px 12px 4px', margin: 0, borderBottom: '1px solid #eee', background: '#fafafa' },
  section: { padding: '8px 12px' },
  label: { display: 'block', fontSize: 11, color: '#666', marginTop: 6, marginBottom: 2 },
  input: { width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12, boxSizing: 'border-box' },
  numInput: { width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12, boxSizing: 'border-box' },
  select: { width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12, boxSizing: 'border-box' },
  row: { display: 'flex', gap: 8 },
  checkLabel: { display: 'block', fontSize: 12, marginBottom: 4, cursor: 'pointer' },
  actionBtn: { flex: 1, padding: '6px 12px', background: '#4A90D9', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 },
  judgment: { fontSize: 11, padding: '4px 8px', marginBottom: 4, background: '#fafafa', borderRadius: 4 },
  judgmentSummary: { fontSize: 13, marginBottom: 8, padding: '4px 0' },
};
