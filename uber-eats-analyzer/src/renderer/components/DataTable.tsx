import React from 'react';
import type { Shift } from '../types/shift';
import { yen, km, hours, num } from '../lib/format';

export function DataTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: Shift[];
  onEdit?: (s: Shift) => void;
  onDelete?: (s: Shift) => void;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-auto max-h-[60vh]">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-panel2 text-muted text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">日付</th>
              <th className="text-left px-3 py-2">時間</th>
              <th className="text-right px-3 py-2">稼働</th>
              <th className="text-right px-3 py-2">売上</th>
              <th className="text-right px-3 py-2">件数</th>
              <th className="text-right px-3 py-2">距離</th>
              <th className="text-right px-3 py-2">時給</th>
              <th className="text-left px-3 py-2">エリア</th>
              <th className="text-left px-3 py-2">天気</th>
              <th className="text-left px-3 py-2">メモ</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center text-muted py-8">
                  データがありません
                </td>
              </tr>
            )}
            {rows.map((s) => {
              const wage = s.duration_minutes ? s.earnings / (s.duration_minutes / 60) : 0;
              return (
                <tr key={s.id} className="border-t border-border hover:bg-panel2/40">
                  <td className="px-3 py-2 num">{s.date}</td>
                  <td className="px-3 py-2 num">
                    {s.start_time}–{s.end_time}
                  </td>
                  <td className="px-3 py-2 text-right num">{hours(s.duration_minutes)}</td>
                  <td className="px-3 py-2 text-right num text-accent2 font-medium">
                    {yen(s.earnings)}
                  </td>
                  <td className="px-3 py-2 text-right num">{num(s.delivery_count)}</td>
                  <td className="px-3 py-2 text-right num">{km(s.distance_km)}</td>
                  <td className="px-3 py-2 text-right num">{yen(wage)}</td>
                  <td className="px-3 py-2">{s.area ?? '—'}</td>
                  <td className="px-3 py-2">{s.weather ?? '—'}</td>
                  <td className="px-3 py-2 max-w-[220px] truncate" title={s.memo ?? ''}>
                    {s.memo ?? ''}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {onEdit && (
                      <button
                        className="text-xs text-accent2 hover:underline mr-2"
                        onClick={() => onEdit(s)}
                      >
                        編集
                      </button>
                    )}
                    {onDelete && (
                      <button
                        className="text-xs text-danger hover:underline"
                        onClick={() => onDelete(s)}
                      >
                        削除
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
