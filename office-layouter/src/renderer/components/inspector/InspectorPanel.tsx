import type {
  LayoutObject,
  LayoutPlan,
  RoomDoor,
  WallSide,
  Zone,
  ZoneType,
} from '../../models/types';
import { getRotatedSize } from '../../logic/geometry/rect';
import { useProjectStore } from '../../store/projectStore';

type Props = {
  plan: LayoutPlan;
  selectedObject: LayoutObject | undefined;
};

const zoneLabels: Record<ZoneType, string> = {
  work: '執務',
  meeting: '会議',
  reception: '受付',
  support: '共用',
  lounge: 'ラウンジ',
  circulation: '通路',
  focus: '集中',
  custom: 'カスタム',
};

const wallLabels: Record<WallSide, string> = {
  top: '上壁',
  right: '右壁',
  bottom: '下壁',
  left: '左壁',
};

const NumberField = ({
  label,
  value,
  onChange,
  step = 100,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
      {label}
    </span>
    <input
      type="number"
      value={value}
      step={step}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
    />
  </label>
);

const DoorEditor = ({
  door,
  roomWidth,
  roomHeight,
}: {
  door: RoomDoor;
  roomWidth: number;
  roomHeight: number;
}) => {
  const updateDoor = useProjectStore((state) => state.updateDoor);
  const deleteDoor = useProjectStore((state) => state.deleteDoor);
  const axisLimit = door.wall === 'top' || door.wall === 'bottom' ? roomWidth : roomHeight;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-ink">{door.name}</div>
        <button
          type="button"
          onClick={() => deleteDoor(door.id)}
          className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-700"
        >
          削除
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            壁面
          </span>
          <select
            value={door.wall}
            onChange={(event) =>
              updateDoor(door.id, { wall: event.target.value as WallSide })
            }
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {Object.entries(wallLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <NumberField
          label="オフセット"
          value={door.offset}
          onChange={(value) =>
            updateDoor(door.id, { offset: Math.max(0, Math.min(axisLimit - 300, value)) })
          }
        />
        <NumberField
          label="幅"
          value={door.width}
          onChange={(value) => updateDoor(door.id, { width: Math.max(700, value) })}
        />
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            開閉
          </span>
          <select
            value={door.swing}
            onChange={(event) =>
              updateDoor(door.id, { swing: event.target.value as RoomDoor['swing'] })
            }
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="inward">内開き</option>
            <option value="outward">外開き</option>
          </select>
        </label>
      </div>
    </div>
  );
};

const ZoneEditor = ({ zone }: { zone: Zone }) => {
  const updateZone = useProjectStore((state) => state.updateZone);
  const deleteZone = useProjectStore((state) => state.deleteZone);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <input
          type="text"
          value={zone.name}
          onChange={(event) => updateZone(zone.id, { name: event.target.value })}
          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => deleteZone(zone.id)}
          className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-700"
        >
          削除
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            種別
          </span>
          <select
            value={zone.type}
            onChange={(event) =>
              updateZone(zone.id, { type: event.target.value as ZoneType })
            }
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {Object.entries(zoneLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            色
          </span>
          <input
            type="color"
            value={zone.color}
            onChange={(event) => updateZone(zone.id, { color: event.target.value })}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-2 py-2"
          />
        </label>
        <NumberField
          label="X"
          value={zone.rect.x}
          onChange={(value) => updateZone(zone.id, { rect: { ...zone.rect, x: value } })}
        />
        <NumberField
          label="Y"
          value={zone.rect.y}
          onChange={(value) => updateZone(zone.id, { rect: { ...zone.rect, y: value } })}
        />
        <NumberField
          label="幅"
          value={zone.rect.width}
          onChange={(value) =>
            updateZone(zone.id, { rect: { ...zone.rect, width: Math.max(600, value) } })
          }
        />
        <NumberField
          label="奥行"
          value={zone.rect.height}
          onChange={(value) =>
            updateZone(zone.id, { rect: { ...zone.rect, height: Math.max(600, value) } })
          }
        />
      </div>
    </div>
  );
};

export const InspectorPanel = ({ plan, selectedObject }: Props) => {
  const settings = useProjectStore((state) => state.project.settings);
  const updateRoom = useProjectStore((state) => state.updateRoom);
  const addDoor = useProjectStore((state) => state.addDoor);
  const updateSettings = useProjectStore((state) => state.updateSettings);
  const updateObjectFields = useProjectStore((state) => state.updateObjectFields);
  const rotateSelectedObject = useProjectStore((state) => state.rotateSelectedObject);
  const saveSelectedAsCustomLibraryItem = useProjectStore(
    (state) => state.saveSelectedAsCustomLibraryItem,
  );

  const rotatedSize = selectedObject
    ? getRotatedSize(selectedObject.width, selectedObject.height, selectedObject.rotation)
    : null;

  return (
    <aside className="flex h-full flex-col gap-4 overflow-auto rounded-3xl bg-panel p-4 shadow-panel">
      <section>
        <h2 className="text-lg font-semibold text-ink">空間設定</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <NumberField
            label="幅"
            value={plan.room.width}
            onChange={(value) => updateRoom({ width: Math.max(3000, value) })}
          />
          <NumberField
            label="奥行"
            value={plan.room.height}
            onChange={(value) => updateRoom({ height: Math.max(3000, value) })}
          />
          <NumberField
            label="壁厚"
            value={plan.room.wallThickness}
            onChange={(value) => updateRoom({ wallThickness: Math.max(100, value) })}
            step={10}
          />
          <NumberField
            label="通路基準"
            value={settings.minCorridorWidth}
            onChange={(value) => updateSettings({ minCorridorWidth: Math.max(600, value) })}
          />
          <NumberField
            label="椅子引き代"
            value={settings.chairClearance}
            onChange={(value) => updateSettings({ chairClearance: Math.max(500, value) })}
          />
          <NumberField
            label="扉前余白"
            value={settings.doorClearance}
            onChange={(value) => updateSettings({ doorClearance: Math.max(800, value) })}
          />
          <NumberField
            label="会議入口"
            value={settings.meetingEntryClearance}
            onChange={(value) => updateSettings({ meetingEntryClearance: Math.max(800, value) })}
          />
          <NumberField
            label="共用余白"
            value={settings.commonAreaClearance}
            onChange={(value) => updateSettings({ commonAreaClearance: Math.max(800, value) })}
          />
          <NumberField
            label="グリッド"
            value={settings.gridSize}
            onChange={(value) => updateSettings({ gridSize: Math.max(50, value) })}
            step={50}
          />
          <NumberField
            label="壁面スナップ"
            value={settings.wallSnapThreshold}
            onChange={(value) => updateSettings({ wallSnapThreshold: Math.max(50, value) })}
            step={10}
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">扉編集</h2>
          <button
            type="button"
            onClick={() => addDoor('bottom')}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700"
          >
            扉追加
          </button>
        </div>
        <div className="space-y-3">
          {plan.room.doors.map((door) => (
            <DoorEditor
              key={door.id}
              door={door}
              roomWidth={plan.room.width}
              roomHeight={plan.room.height}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">ゾーン編集</h2>
        {plan.zones.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500">
            左パネルからゾーンを追加してください。ここで名前、色、サイズを編集できます。
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {plan.zones.map((zone) => (
              <ZoneEditor key={zone.id} zone={zone} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">選択要素</h2>
        {!selectedObject ? (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500">
            キャンバス上のオブジェクトを選択すると位置、サイズ、席数を編集できます。
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                名称
              </span>
              <input
                type="text"
                value={selectedObject.name}
                onChange={(event) =>
                  updateObjectFields(selectedObject.id, { name: event.target.value })
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="X"
                value={selectedObject.x}
                onChange={(value) => updateObjectFields(selectedObject.id, { x: value })}
              />
              <NumberField
                label="Y"
                value={selectedObject.y}
                onChange={(value) => updateObjectFields(selectedObject.id, { y: value })}
              />
              <NumberField
                label="幅"
                value={selectedObject.width}
                onChange={(value) =>
                  updateObjectFields(selectedObject.id, { width: Math.max(300, value) })
                }
              />
              <NumberField
                label="奥行"
                value={selectedObject.height}
                onChange={(value) =>
                  updateObjectFields(selectedObject.id, { height: Math.max(300, value) })
                }
              />
              <NumberField
                label="席数"
                value={selectedObject.seatCount}
                onChange={(value) =>
                  updateObjectFields(selectedObject.id, { seatCount: Math.max(0, value) })
                }
                step={1}
              />
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 text-sm text-slate-600">
              <div>表示サイズ: {rotatedSize?.width} x {rotatedSize?.height}</div>
              <div>回転: {selectedObject.rotation}°</div>
              <div>
                推奨ゾーン:{' '}
                {selectedObject.metadata.preferredZoneTypes?.map((type) => zoneLabels[type]).join(' / ') ??
                  '未設定'}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={rotateSelectedObject}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                90°回転
              </button>
              <button
                type="button"
                onClick={saveSelectedAsCustomLibraryItem}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                カスタム登録
              </button>
            </div>
          </div>
        )}
      </section>
    </aside>
  );
};
