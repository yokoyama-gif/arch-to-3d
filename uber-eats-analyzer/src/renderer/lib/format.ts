export const yen = (n: number) =>
  isFinite(n) ? '¥' + Math.round(n).toLocaleString('ja-JP') : '—';

export const yenK = (n: number) => {
  if (!isFinite(n)) return '—';
  if (Math.abs(n) >= 10000) return '¥' + (n / 10000).toFixed(1) + '万';
  return yen(n);
};

export const km = (n: number) => (isFinite(n) ? n.toFixed(1) + ' km' : '—');

export const hours = (minutes: number) => {
  if (!isFinite(minutes)) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

export const num = (n: number, digits = 0) =>
  isFinite(n) ? n.toLocaleString('ja-JP', { maximumFractionDigits: digits }) : '—';

export const pct = (n: number) => (isFinite(n) ? n.toFixed(1) + '%' : '—');

export function diffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins;
}

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}
