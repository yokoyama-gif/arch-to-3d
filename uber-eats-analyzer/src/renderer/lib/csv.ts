import type { Shift, ShiftInput } from '../types/shift';
import { diffMinutes } from './format';

const HEADER = [
  'date',
  'start_time',
  'end_time',
  'duration_minutes',
  'earnings',
  'delivery_count',
  'distance_km',
  'area',
  'weather',
  'memo',
];

function escape(v: string | number | null): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function shiftsToCsv(shifts: Shift[]): string {
  const rows = [HEADER.join(',')];
  for (const s of shifts) {
    rows.push(
      [
        s.date,
        s.start_time,
        s.end_time,
        s.duration_minutes,
        s.earnings,
        s.delivery_count,
        s.distance_km,
        s.area,
        s.weather,
        s.memo,
      ]
        .map(escape)
        .join(','),
    );
  }
  return rows.join('\n');
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else cur += ch;
    } else {
      if (ch === ',') {
        out.push(cur);
        cur = '';
      } else if (ch === '"' && cur === '') {
        inQ = true;
      } else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export type CsvParseResult = {
  rows: ShiftInput[];
  errors: { line: number; message: string }[];
};

export function csvToShifts(text: string): CsvParseResult {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], errors: [{ line: 0, message: '空のCSVです' }] };

  const headerCells = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headerCells.indexOf(name);
  const required = ['date', 'start_time', 'end_time', 'earnings', 'delivery_count', 'distance_km'];
  const missing = required.filter((r) => idx(r) < 0);
  if (missing.length) {
    return {
      rows: [],
      errors: [{ line: 1, message: `必須列が不足: ${missing.join(', ')}` }],
    };
  }

  const rows: ShiftInput[] = [];
  const errors: { line: number; message: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    try {
      const date = cells[idx('date')]?.trim();
      const start_time = cells[idx('start_time')]?.trim();
      const end_time = cells[idx('end_time')]?.trim();
      const earnings = Math.round(Number(cells[idx('earnings')] || 0));
      const delivery_count = Math.round(Number(cells[idx('delivery_count')] || 0));
      const distance_km = Number(cells[idx('distance_km')] || 0);
      const area = idx('area') >= 0 ? cells[idx('area')]?.trim() || null : null;
      const weather = idx('weather') >= 0 ? cells[idx('weather')]?.trim() || null : null;
      const memo = idx('memo') >= 0 ? cells[idx('memo')]?.trim() || null : null;
      const explicit = idx('duration_minutes') >= 0 ? Number(cells[idx('duration_minutes')] || 0) : 0;
      const duration_minutes = explicit > 0 ? Math.round(explicit) : diffMinutes(start_time, end_time);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('日付形式 YYYY-MM-DD ではありません');
      if (!/^\d{2}:\d{2}$/.test(start_time)) throw new Error('開始時刻形式 HH:MM ではありません');
      if (!/^\d{2}:\d{2}$/.test(end_time)) throw new Error('終了時刻形式 HH:MM ではありません');
      if (!isFinite(earnings) || earnings < 0) throw new Error('売上が不正');
      if (!isFinite(delivery_count) || delivery_count < 0) throw new Error('件数が不正');
      if (!isFinite(distance_km) || distance_km < 0) throw new Error('距離が不正');

      rows.push({
        date,
        start_time,
        end_time,
        duration_minutes,
        earnings,
        delivery_count,
        distance_km,
        area,
        weather,
        memo,
        source: 'csv',
      });
    } catch (e) {
      errors.push({ line: i + 1, message: (e as Error).message });
    }
  }
  return { rows, errors };
}

export const CSV_TEMPLATE =
  HEADER.join(',') +
  '\n2026-05-01,11:00,14:00,180,4500,12,28.5,渋谷,晴,ランチピーク\n';
