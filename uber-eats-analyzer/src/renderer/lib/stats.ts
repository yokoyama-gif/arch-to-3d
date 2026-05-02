import type { Shift } from '../types/shift';
import { monthOf, todayIso } from './format';

export type Totals = {
  earnings: number;
  deliveries: number;
  distanceKm: number;
  durationMin: number;
  hourlyWage: number;
  perDelivery: number;
  perKm: number;
  perHourDeliveries: number;
  avgDeliveryMin: number;
};

export function aggregate(shifts: Shift[]): Totals {
  const earnings = shifts.reduce((s, x) => s + x.earnings, 0);
  const deliveries = shifts.reduce((s, x) => s + x.delivery_count, 0);
  const distanceKm = shifts.reduce((s, x) => s + x.distance_km, 0);
  const durationMin = shifts.reduce((s, x) => s + x.duration_minutes, 0);
  const hours = durationMin / 60;
  return {
    earnings,
    deliveries,
    distanceKm,
    durationMin,
    hourlyWage: hours ? earnings / hours : 0,
    perDelivery: deliveries ? earnings / deliveries : 0,
    perKm: distanceKm ? earnings / distanceKm : 0,
    perHourDeliveries: hours ? deliveries / hours : 0,
    avgDeliveryMin: deliveries ? durationMin / deliveries : 0,
  };
}

export function shiftsOnDate(shifts: Shift[], iso: string) {
  return shifts.filter((s) => s.date === iso);
}

export function shiftsThisMonth(shifts: Shift[], yyyymm = monthOf(todayIso())) {
  return shifts.filter((s) => monthOf(s.date) === yyyymm);
}

export function byHourOfDay(shifts: Shift[]): { hour: number; earnings: number }[] {
  const buckets = new Array(24).fill(0) as number[];
  for (const s of shifts) {
    const startH = parseInt(s.start_time.slice(0, 2), 10);
    const totalMin = s.duration_minutes;
    if (!isFinite(startH) || totalMin <= 0) continue;
    const yenPerMin = s.earnings / totalMin;
    let remaining = totalMin;
    let h = startH;
    let minInHour = parseInt(s.start_time.slice(3, 5), 10);
    while (remaining > 0) {
      const minThisHour = Math.min(60 - minInHour, remaining);
      buckets[h % 24] += yenPerMin * minThisHour;
      remaining -= minThisHour;
      h = (h + 1) % 24;
      minInHour = 0;
    }
  }
  return buckets.map((earnings, hour) => ({ hour, earnings }));
}

function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function byDate(shifts: Shift[], days = 30): { date: string; earnings: number }[] {
  const map = new Map<string, number>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    map.set(toLocalIso(d), 0);
  }
  for (const s of shifts) {
    if (map.has(s.date)) map.set(s.date, (map.get(s.date) ?? 0) + s.earnings);
  }
  return Array.from(map.entries()).map(([date, earnings]) => ({ date, earnings }));
}

export function byArea(shifts: Shift[]): { area: string; earnings: number; count: number; hourlyWage: number }[] {
  const map = new Map<string, { earnings: number; count: number; minutes: number }>();
  for (const s of shifts) {
    const key = (s.area && s.area.trim()) || '未設定';
    const cur = map.get(key) ?? { earnings: 0, count: 0, minutes: 0 };
    cur.earnings += s.earnings;
    cur.count += 1;
    cur.minutes += s.duration_minutes;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([area, v]) => ({
      area,
      earnings: v.earnings,
      count: v.count,
      hourlyWage: v.minutes ? v.earnings / (v.minutes / 60) : 0,
    }))
    .sort((a, b) => b.earnings - a.earnings);
}

export function uniqueAreas(shifts: Shift[]): string[] {
  const set = new Set<string>();
  for (const s of shifts) if (s.area && s.area.trim()) set.add(s.area.trim());
  return Array.from(set).sort();
}
