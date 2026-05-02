import React from 'react';

export function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'accent' | 'warn' | 'danger' | 'muted';
}) {
  const tone =
    accent === 'warn'
      ? 'text-warn'
      : accent === 'danger'
      ? 'text-danger'
      : accent === 'muted'
      ? 'text-muted'
      : 'text-accent2';
  return (
    <div className="panel p-5 flex flex-col gap-1">
      <div className="text-xs text-muted uppercase tracking-wide">{label}</div>
      <div className={`num text-[2.4rem] leading-none mt-1 ${tone} font-semibold`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}
