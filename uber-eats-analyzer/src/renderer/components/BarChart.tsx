import React from 'react';

export type BarDatum = { label: string; value: number; sub?: string };

export function BarChart({
  data,
  height = 180,
  valueFormat,
  barColor = '#10b981',
  highlightLabel,
}: {
  data: BarDatum[];
  height?: number;
  valueFormat: (v: number) => string;
  barColor?: string;
  highlightLabel?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = Math.max(560, data.length * 28);
  const padL = 8;
  const padR = 8;
  const padT = 14;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = height - padT - padB;
  const barW = (innerW / data.length) * 0.7;
  const step = innerW / data.length;

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={height} className="block">
        {/* axis baseline */}
        <line
          x1={padL}
          x2={W - padR}
          y1={padT + innerH}
          y2={padT + innerH}
          stroke="#1f2a44"
        />
        {data.map((d, i) => {
          const h = (d.value / max) * innerH;
          const x = padL + i * step + (step - barW) / 2;
          const y = padT + innerH - h;
          const hi = highlightLabel && d.label === highlightLabel;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={3}
                fill={hi ? '#34d399' : barColor}
                opacity={d.value === 0 ? 0.25 : 0.9}
              >
                <title>{`${d.label}: ${valueFormat(d.value)}`}</title>
              </rect>
              <text
                x={x + barW / 2}
                y={padT + innerH + 14}
                textAnchor="middle"
                fontSize={10}
                fill="#8b97ad"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
