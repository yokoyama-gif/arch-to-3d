import React, { useMemo, useState } from 'react';
import { useShiftStore } from '../store/shiftStore';
import { DataTable } from '../components/DataTable';
import { aggregate, uniqueAreas } from '../lib/stats';
import { diffMinutes, hours, km, num, yen } from '../lib/format';
import { WEATHER_OPTIONS, type Shift, type ShiftInput } from '../types/shift';
import { shiftsToCsv } from '../lib/csv';

export function HistoryPage() {
  const shifts = useShiftStore((s) => s.shifts);
  const remove = useShiftStore((s) => s.remove);
  const update = useShiftStore((s) => s.update);
  const showToast = useShiftStore((s) => s.showToast);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [area, setArea] = useState('');
  const [weather, setWeather] = useState('');
  const [editing, setEditing] = useState<Shift | null>(null);

  const areas = useMemo(() => uniqueAreas(shifts), [shifts]);

  const filtered = useMemo(() => {
    return shifts.filter((s) => {
      if (from && s.date < from) return false;
      if (to && s.date > to) return false;
      if (area && s.area !== area) return false;
      if (weather && s.weather !== weather) return false;
      return true;
    });
  }, [shifts, from, to, area, weather]);

  const totals = aggregate(filtered);

  const handleDelete = async (s: Shift) => {
    if (!confirm(`${s.date} ${s.start_time}-${s.end_time} の稼働を削除しますか？`)) return;
    await remove(s.id);
    showToast('削除しました');
  };

  const handleExport = async () => {
    const csv = shiftsToCsv(filtered);
    const res = await window.uberApi.saveText({
      defaultPath: `uber-eats-shifts-${new Date().toISOString().slice(0, 10)}.csv`,
      content: csv,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (!res.canceled) showToast(`CSVを書き出しました (${filtered.length}件)`);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-semibold">履歴</h1>
        <button className="btn-ghost" onClick={handleExport} disabled={filtered.length === 0}>
          CSVエクスポート
        </button>
      </div>

      <div className="panel p-4 grid grid-cols-12 gap-3">
        <div className="col-span-2">
          <label className="label">開始日</label>
          <input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">終了日</label>
          <input type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="col-span-3">
          <label className="label">エリア</label>
          <select className="field" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">すべて</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">天気</label>
          <select className="field" value={weather} onChange={(e) => setWeather(e.target.value)}>
            <option value="">すべて</option>
            {WEATHER_OPTIONS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-3 flex items-end justify-end">
          <button
            className="btn-ghost"
            onClick={() => {
              setFrom('');
              setTo('');
              setArea('');
              setWeather('');
            }}
          >
            条件クリア
          </button>
        </div>

        <div className="col-span-12 grid grid-cols-5 gap-3 mt-1">
          <Mini label="件数" value={`${filtered.length} 回`} />
          <Mini label="売上合計" value={yen(totals.earnings)} />
          <Mini label="平均時給" value={yen(totals.hourlyWage)} highlight />
          <Mini label="配達件数" value={`${num(totals.deliveries)} 件`} />
          <Mini label="走行距離" value={km(totals.distanceKm)} />
        </div>
      </div>

      <DataTable rows={filtered} onEdit={setEditing} onDelete={handleDelete} />

      <div className="text-xs text-muted px-1">
        合計稼働時間 <span className="num text-ink">{hours(totals.durationMin)}</span> ·
        平均件数/時 <span className="num text-ink">{num(totals.perHourDeliveries, 1)}</span> 件 ·
        1km単価 <span className="num text-ink">{yen(totals.perKm)}</span>
      </div>

      {editing && (
        <EditModal
          shift={editing}
          onClose={() => setEditing(null)}
          onSave={async (id, input) => {
            await update(id, input);
            setEditing(null);
            showToast('更新しました');
          }}
        />
      )}
    </div>
  );
}

function Mini({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-panel2 border border-border rounded-lg px-3 py-2">
      <div className="text-[10px] text-muted uppercase">{label}</div>
      <div className={`num text-lg ${highlight ? 'text-accent2 font-semibold' : 'text-ink'}`}>
        {value}
      </div>
    </div>
  );
}

function EditModal({
  shift,
  onClose,
  onSave,
}: {
  shift: Shift;
  onClose: () => void;
  onSave: (id: number, input: ShiftInput) => Promise<void>;
}) {
  const [date, setDate] = useState(shift.date);
  const [start, setStart] = useState(shift.start_time);
  const [end, setEnd] = useState(shift.end_time);
  const [duration, setDuration] = useState(shift.duration_minutes);
  const [earnings, setEarnings] = useState(String(shift.earnings));
  const [count, setCount] = useState(String(shift.delivery_count));
  const [distance, setDistance] = useState(String(shift.distance_km));
  const [area, setArea] = useState(shift.area ?? '');
  const [weather, setWeather] = useState(shift.weather ?? '');
  const [memo, setMemo] = useState(shift.memo ?? '');
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="panel p-6 w-[720px] max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-baseline mb-4">
          <h2 className="text-lg font-semibold">稼働を編集</h2>
          <button className="text-muted hover:text-ink text-2xl leading-none" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-4">
            <label className="label">日付</label>
            <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="col-span-3">
            <label className="label">開始</label>
            <input
              type="time"
              className="field"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setDuration(diffMinutes(e.target.value, end));
              }}
            />
          </div>
          <div className="col-span-3">
            <label className="label">終了</label>
            <input
              type="time"
              className="field"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setDuration(diffMinutes(start, e.target.value));
              }}
            />
          </div>
          <div className="col-span-2">
            <label className="label">分</label>
            <input
              type="number"
              className="field"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>
          <div className="col-span-4">
            <label className="label">売上</label>
            <input type="number" className="field num" value={earnings} onChange={(e) => setEarnings(e.target.value)} />
          </div>
          <div className="col-span-4">
            <label className="label">件数</label>
            <input type="number" className="field num" value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div className="col-span-4">
            <label className="label">距離 km</label>
            <input type="number" className="field num" value={distance} onChange={(e) => setDistance(e.target.value)} />
          </div>
          <div className="col-span-5">
            <label className="label">エリア</label>
            <input type="text" className="field" value={area} onChange={(e) => setArea(e.target.value)} />
          </div>
          <div className="col-span-3">
            <label className="label">天気</label>
            <select className="field" value={weather} onChange={(e) => setWeather(e.target.value)}>
              <option value="">—</option>
              {WEATHER_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-12">
            <label className="label">メモ</label>
            <input type="text" className="field" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(shift.id, {
                  date,
                  start_time: start,
                  end_time: end,
                  duration_minutes: duration,
                  earnings: Math.round(Number(earnings) || 0),
                  delivery_count: Math.round(Number(count) || 0),
                  distance_km: Number(distance) || 0,
                  area: area.trim() || null,
                  weather: weather || null,
                  memo: memo.trim() || null,
                });
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
