import React, { useState } from 'react';
import { csvToShifts, CSV_TEMPLATE } from '../lib/csv';
import { useShiftStore } from '../store/shiftStore';
import { yen, num } from '../lib/format';

export function ImportPage({ onDone }: { onDone?: () => void }) {
  const bulkAdd = useShiftStore((s) => s.bulkAdd);
  const showToast = useShiftStore((s) => s.showToast);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ReturnType<typeof csvToShifts> | null>(null);
  const [busy, setBusy] = useState(false);

  const handleParse = () => setParsed(csvToShifts(text));

  const handleOpenFile = async () => {
    const res = await window.uberApi.openText({ filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (!res.canceled && res.content) {
      setText(res.content);
      setParsed(csvToShifts(res.content));
    }
  };

  const handleConfirm = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    setBusy(true);
    try {
      const n = await bulkAdd(parsed.rows);
      showToast(`${n}件をインポートしました`);
      setText('');
      setParsed(null);
      onDone?.();
    } catch (e) {
      alert('インポート失敗: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sumEarnings = parsed?.rows.reduce((s, r) => s + r.earnings, 0) ?? 0;
  const sumDeliveries = parsed?.rows.reduce((s, r) => s + r.delivery_count, 0) ?? 0;

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <h1 className="text-xl font-semibold">CSVインポート</h1>

      <div className="panel p-5">
        <div className="text-sm text-muted mb-2">
          必須列: <code>date, start_time, end_time, earnings, delivery_count, distance_km</code>
          （任意: <code>duration_minutes, area, weather, memo</code>）
        </div>
        <div className="flex gap-2 mb-3">
          <button className="btn-ghost" onClick={handleOpenFile}>
            ファイルから読み込み
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              setText(CSV_TEMPLATE);
              setParsed(null);
            }}
          >
            テンプレートを挿入
          </button>
          <button className="btn-primary ml-auto" onClick={handleParse} disabled={!text.trim()}>
            プレビュー
          </button>
        </div>
        <textarea
          className="field font-mono text-xs h-48 leading-5"
          placeholder="ここにCSVを貼り付け..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      {parsed && (
        <div className="panel p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-semibold">プレビュー</h2>
            <div className="text-xs text-muted">
              成功 <span className="text-accent2 num">{parsed.rows.length}</span> 行 / エラー{' '}
              <span className="text-danger num">{parsed.errors.length}</span> 行
            </div>
          </div>

          {parsed.errors.length > 0 && (
            <div className="mb-3 text-xs text-danger bg-danger/10 border border-danger/30 rounded p-2 max-h-32 overflow-auto">
              {parsed.errors.map((e, i) => (
                <div key={i}>
                  Line {e.line}: {e.message}
                </div>
              ))}
            </div>
          )}

          {parsed.rows.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                <Mini label="行数" value={`${parsed.rows.length} 行`} />
                <Mini label="売上合計" value={yen(sumEarnings)} highlight />
                <Mini label="配達件数" value={`${num(sumDeliveries)} 件`} />
              </div>
              <div className="overflow-auto max-h-72 border border-border rounded">
                <table className="min-w-full text-xs">
                  <thead className="bg-panel2 text-muted uppercase">
                    <tr>
                      <th className="text-left px-2 py-1.5">日付</th>
                      <th className="text-left px-2 py-1.5">時間</th>
                      <th className="text-right px-2 py-1.5">売上</th>
                      <th className="text-right px-2 py-1.5">件数</th>
                      <th className="text-right px-2 py-1.5">距離</th>
                      <th className="text-left px-2 py-1.5">エリア</th>
                      <th className="text-left px-2 py-1.5">天気</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 200).map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-2 py-1 num">{r.date}</td>
                        <td className="px-2 py-1 num">
                          {r.start_time}-{r.end_time}
                        </td>
                        <td className="px-2 py-1 text-right num">{yen(r.earnings)}</td>
                        <td className="px-2 py-1 text-right num">{r.delivery_count}</td>
                        <td className="px-2 py-1 text-right num">{r.distance_km.toFixed(1)}</td>
                        <td className="px-2 py-1">{r.area ?? '—'}</td>
                        <td className="px-2 py-1">{r.weather ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-3">
                <button className="btn-primary" disabled={busy} onClick={handleConfirm}>
                  {busy ? 'インポート中…' : `${parsed.rows.length}件を取り込む`}
                </button>
              </div>
            </>
          )}
        </div>
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
