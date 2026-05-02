import React, { useMemo } from 'react';
import { useShiftStore } from '../store/shiftStore';
import { KpiCard } from '../components/KpiCard';
import { BarChart } from '../components/BarChart';
import {
  aggregate,
  byArea,
  byDate,
  byHourOfDay,
  shiftsOnDate,
  shiftsThisMonth,
} from '../lib/stats';
import { hours, km, num, todayIso, yen, yenK } from '../lib/format';
import type { RouteKey } from '../components/Sidebar';

export function DashboardPage({ onJump }: { onJump: (k: RouteKey) => void }) {
  const shifts = useShiftStore((s) => s.shifts);
  const loading = useShiftStore((s) => s.loading);

  const today = todayIso();
  const todays = shiftsOnDate(shifts, today);
  const month = shiftsThisMonth(shifts);
  const totalsToday = aggregate(todays);
  const totalsMonth = aggregate(month);
  const totalsAll = aggregate(shifts);

  const hourly = useMemo(() => byHourOfDay(shifts), [shifts]);
  const daily = useMemo(() => byDate(shifts, 30), [shifts]);
  const areas = useMemo(() => byArea(shifts).slice(0, 5), [shifts]);

  const peakHour = hourly.reduce((a, b) => (b.earnings > a.earnings ? b : a), hourly[0]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">ダッシュボード</h1>
          <div className="text-xs text-muted mt-0.5">
            {today} 時点 · 全 {shifts.length} 件の稼働ログ
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => onJump('entry')}>
            ＋ 稼働を記録
          </button>
        </div>
      </div>

      {shifts.length === 0 && !loading && (
        <div className="panel p-8 text-center">
          <div className="text-muted mb-4">まだ稼働データがありません。</div>
          <div className="flex justify-center gap-2">
            <button className="btn-primary" onClick={() => onJump('entry')}>
              手入力で記録
            </button>
            <button className="btn-ghost" onClick={() => onJump('import')}>
              CSVから一括インポート
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="今日の売上"
          value={yen(totalsToday.earnings)}
          sub={`${todays.length}回 / ${num(totalsToday.deliveries)}件`}
        />
        <KpiCard
          label="今月の売上"
          value={yenK(totalsMonth.earnings)}
          sub={`${month.length}回 / ${num(totalsMonth.deliveries)}件`}
        />
        <KpiCard
          label="平均時給 (全期間)"
          value={yen(totalsAll.hourlyWage)}
          sub={`配達単価 ${yen(totalsAll.perDelivery)}`}
          accent="warn"
        />
        <KpiCard
          label="走行距離 (今月)"
          value={km(totalsMonth.distanceKm)}
          sub={`1km単価 ${yen(totalsMonth.perKm)}`}
          accent="muted"
        />
      </div>

      <section className="panel p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold">時間帯別 売上</h2>
          <div className="text-xs text-muted">
            ピーク帯:{' '}
            <span className="text-accent2 num">
              {peakHour ? `${peakHour.hour}時台 ${yen(peakHour.earnings)}` : '—'}
            </span>
          </div>
        </div>
        <BarChart
          data={hourly.map((h) => ({ label: `${h.hour}`, value: h.earnings }))}
          valueFormat={yen}
          highlightLabel={peakHour ? String(peakHour.hour) : undefined}
        />
      </section>

      <section className="panel p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold">日別売上 (直近30日)</h2>
          <div className="text-xs text-muted">
            合計{' '}
            <span className="num text-accent2">
              {yenK(daily.reduce((s, d) => s + d.earnings, 0))}
            </span>
          </div>
        </div>
        <BarChart
          data={daily.map((d) => ({
            label: d.date.slice(5).replace('-', '/'),
            value: d.earnings,
          }))}
          valueFormat={yen}
          height={170}
        />
      </section>

      <section className="grid grid-cols-3 gap-4">
        <div className="panel p-5 col-span-2">
          <h2 className="font-semibold mb-3">エリア別売上 ランキング</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted uppercase">
              <tr>
                <th className="text-left py-1">#</th>
                <th className="text-left py-1">エリア</th>
                <th className="text-right py-1">回数</th>
                <th className="text-right py-1">売上</th>
                <th className="text-right py-1">平均時給</th>
              </tr>
            </thead>
            <tbody>
              {areas.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-6">
                    データがありません
                  </td>
                </tr>
              )}
              {areas.map((a, i) => (
                <tr key={a.area} className="border-t border-border">
                  <td className="py-2 num text-muted">{i + 1}</td>
                  <td className="py-2">{a.area}</td>
                  <td className="py-2 text-right num">{num(a.count)}</td>
                  <td className="py-2 text-right num text-accent2">{yen(a.earnings)}</td>
                  <td className="py-2 text-right num">{yen(a.hourlyWage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel p-5">
          <h2 className="font-semibold mb-3">通算サマリ</h2>
          <SummaryRow label="総稼働" value={hours(totalsAll.durationMin)} />
          <SummaryRow label="総売上" value={yenK(totalsAll.earnings)} />
          <SummaryRow label="総件数" value={num(totalsAll.deliveries) + ' 件'} />
          <SummaryRow label="総距離" value={km(totalsAll.distanceKm)} />
          <SummaryRow label="平均時給" value={yen(totalsAll.hourlyWage)} highlight />
          <SummaryRow label="件数 / 時" value={num(totalsAll.perHourDeliveries, 1) + ' 件'} />
          <SummaryRow
            label="平均配達時間"
            value={(totalsAll.avgDeliveryMin || 0).toFixed(1) + ' 分/件'}
          />
        </div>
      </section>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline py-2 border-b border-border last:border-0">
      <div className="text-xs text-muted">{label}</div>
      <div className={`num ${highlight ? 'text-accent2 text-lg font-semibold' : ''}`}>{value}</div>
    </div>
  );
}
