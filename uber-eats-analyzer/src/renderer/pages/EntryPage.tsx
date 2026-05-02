import React, { useEffect, useMemo, useState } from 'react';
import { useShiftStore } from '../store/shiftStore';
import { diffMinutes, todayIso, hours, yen } from '../lib/format';
import { WEATHER_OPTIONS } from '../types/shift';

export function EntryPage({ onSaved }: { onSaved?: () => void }) {
  const add = useShiftStore((s) => s.add);
  const showToast = useShiftStore((s) => s.showToast);

  const [date, setDate] = useState(todayIso());
  const [start, setStart] = useState('11:00');
  const [end, setEnd] = useState('14:00');
  const [duration, setDuration] = useState<number>(180);
  const [autoDuration, setAutoDuration] = useState(true);
  const [earnings, setEarnings] = useState<string>('');
  const [count, setCount] = useState<string>('');
  const [distance, setDistance] = useState<string>('');
  const [area, setArea] = useState('');
  const [weather, setWeather] = useState<string>('');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (autoDuration) setDuration(diffMinutes(start, end));
  }, [start, end, autoDuration]);

  const earningsN = Number(earnings) || 0;
  const countN = Number(count) || 0;
  const distanceN = Number(distance) || 0;

  const previewWage = useMemo(
    () => (duration > 0 ? earningsN / (duration / 60) : 0),
    [earningsN, duration],
  );
  const previewPerOrder = useMemo(
    () => (countN > 0 ? earningsN / countN : 0),
    [earningsN, countN],
  );
  const previewPerKm = useMemo(
    () => (distanceN > 0 ? earningsN / distanceN : 0),
    [earningsN, distanceN],
  );

  const canSubmit =
    !!date && !!start && !!end && duration > 0 && earningsN >= 0 && countN >= 0 && distanceN >= 0;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await add({
        date,
        start_time: start,
        end_time: end,
        duration_minutes: duration,
        earnings: Math.round(earningsN),
        delivery_count: Math.round(countN),
        distance_km: distanceN,
        area: area.trim() || null,
        weather: weather || null,
        memo: memo.trim() || null,
      });
      showToast(`保存しました 実質時給 ${yen(previewWage)}`);
      setEarnings('');
      setCount('');
      setDistance('');
      setMemo('');
      onSaved?.();
    } catch (e) {
      alert('保存に失敗: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-semibold mb-4">稼働を記録</h1>

      <div className="panel p-6 grid grid-cols-12 gap-4">
        <div className="col-span-3">
          <label className="label">日付</label>
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="col-span-3">
          <label className="label">開始時刻</label>
          <input type="time" className="field" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="col-span-3">
          <label className="label">終了時刻</label>
          <input type="time" className="field" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="col-span-3">
          <label className="label">稼働時間 (分)</label>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              className="field"
              min={0}
              value={duration}
              onChange={(e) => {
                setAutoDuration(false);
                setDuration(Number(e.target.value));
              }}
            />
            <button
              type="button"
              className="text-xs text-muted hover:text-accent2 whitespace-nowrap"
              onClick={() => {
                setAutoDuration(true);
                setDuration(diffMinutes(start, end));
              }}
            >
              自動
            </button>
          </div>
          <div className="text-xs text-muted mt-1">{hours(duration)}</div>
        </div>

        <div className="col-span-4">
          <label className="label">売上 (円)</label>
          <input
            type="number"
            inputMode="numeric"
            className="field text-lg num"
            placeholder="例: 4500"
            value={earnings}
            onChange={(e) => setEarnings(e.target.value)}
          />
        </div>
        <div className="col-span-4">
          <label className="label">配達件数</label>
          <input
            type="number"
            inputMode="numeric"
            className="field text-lg num"
            placeholder="例: 12"
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </div>
        <div className="col-span-4">
          <label className="label">走行距離 (km)</label>
          <input
            type="number"
            inputMode="decimal"
            className="field text-lg num"
            placeholder="例: 28.5"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
          />
        </div>

        <div className="col-span-5">
          <label className="label">主な稼働エリア</label>
          <input
            type="text"
            className="field"
            placeholder="例: 渋谷, 新宿"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
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
        <div className="col-span-4">
          <label className="label">メモ</label>
          <input
            type="text"
            className="field"
            placeholder="クエスト情報など"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        <div className="col-span-12 grid grid-cols-3 gap-3 mt-2">
          <Preview label="実質時給" value={yen(previewWage)} />
          <Preview label="1件あたり" value={yen(previewPerOrder)} />
          <Preview label="1kmあたり" value={yen(previewPerKm)} />
        </div>

        <div className="col-span-12 flex justify-end gap-2 mt-2">
          <button className="btn-ghost" onClick={onSaved}>
            キャンセル
          </button>
          <button className="btn-primary" disabled={!canSubmit || submitting} onClick={submit}>
            {submitting ? '保存中…' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Preview({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel2 border border-border rounded-lg px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="num text-2xl text-accent2 font-semibold mt-1">{value}</div>
    </div>
  );
}
