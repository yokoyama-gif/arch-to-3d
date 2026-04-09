import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  LayoutObject,
  LayoutPlan,
  OverlayKind,
  PlanOverlay,
  Severity,
} from '../../models/types';
import {
  getDoorRect,
  getObjectRect,
  getRoomRect,
} from '../../logic/geometry/rect';
import { buildPlanOverlays } from '../../logic/overlays/buildPlanOverlays';
import { useProjectStore } from '../../store/projectStore';

type Props = {
  plan: LayoutPlan;
  selectedObjectId: string | null;
};

type DragState = {
  objectId: string;
  offsetX: number;
  offsetY: number;
} | null;

const severityRank: Record<Severity, number> = {
  ok: 0,
  warning: 1,
  ng: 2,
};

const issueStyles: Record<Severity, { stroke: string; fill: string }> = {
  ok: { stroke: '#0f766e', fill: 'rgba(15, 118, 110, 0.08)' },
  warning: { stroke: '#d97706', fill: 'rgba(217, 119, 6, 0.14)' },
  ng: { stroke: '#dc2626', fill: 'rgba(220, 38, 38, 0.18)' },
};

const overlayStyles: Record<OverlayKind, { stroke: string; fill: string; label: string }> = {
  corridor: { stroke: '#2563eb', fill: 'rgba(37, 99, 235, 0.08)', label: '通路' },
  chair: { stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.08)', label: '椅子' },
  door: { stroke: '#16a34a', fill: 'rgba(22, 163, 74, 0.08)', label: '扉前' },
  reception: { stroke: '#15803d', fill: 'rgba(21, 128, 61, 0.08)', label: '受付前' },
  copy: { stroke: '#475569', fill: 'rgba(71, 85, 105, 0.08)', label: 'コピー前' },
  meeting: { stroke: '#7c3aed', fill: 'rgba(124, 58, 237, 0.08)', label: '会議前' },
};

const overlayOrder: OverlayKind[] = [
  'corridor',
  'chair',
  'door',
  'reception',
  'copy',
  'meeting',
];

const zoneStroke: Record<string, string> = {
  work: '#2563eb',
  meeting: '#7c3aed',
  reception: '#15803d',
  support: '#b45309',
  lounge: '#db2777',
  circulation: '#475569',
  focus: '#0284c7',
  custom: '#64748b',
};

export const LayoutCanvas = ({ plan, selectedObjectId }: Props) => {
  const selectObject = useProjectStore((state) => state.selectObject);
  const updateObjectPosition = useProjectStore((state) => state.updateObjectPosition);
  const settings = useProjectStore((state) => state.project.settings);
  const overlayVisibility = useProjectStore((state) => state.overlayVisibility);
  const toggleOverlay = useProjectStore((state) => state.toggleOverlay);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 680 });
  const [dragState, setDragState] = useState<DragState>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      setCanvasSize({
        width: entry.contentRect.width - 16,
        height: entry.contentRect.height - 16,
      });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const scale = useMemo(() => {
    return Math.max(
      0.05,
      Math.min(canvasSize.width / plan.room.width, canvasSize.height / plan.room.height),
    );
  }, [canvasSize.height, canvasSize.width, plan.room.height, plan.room.width]);

  const issueMap = useMemo(() => {
    const map = new Map<string, Severity>();
    for (const issue of plan.evaluation.issues) {
      for (const objectId of issue.objectIds) {
        const current = map.get(objectId) ?? 'ok';
        if (severityRank[issue.severity] > severityRank[current]) {
          map.set(objectId, issue.severity);
        }
      }
    }
    return map;
  }, [plan.evaluation.issues]);

  const overlays = useMemo(
    () =>
      buildPlanOverlays(plan, {
        minCorridorWidth: settings.minCorridorWidth,
        chairClearance: settings.chairClearance,
        doorClearance: settings.doorClearance,
        meetingEntryClearance: settings.meetingEntryClearance,
      }),
    [plan, settings],
  );

  const overlayCounts = useMemo(
    () =>
      overlays.reduce<Record<OverlayKind, number>>(
        (acc, overlay) => {
          acc[overlay.kind] += 1;
          return acc;
        },
        {
          corridor: 0,
          chair: 0,
          door: 0,
          reception: 0,
          copy: 0,
          meeting: 0,
        },
      ),
    [overlays],
  );

  const visibleOverlays = useMemo(
    () => overlays.filter((overlay) => overlayVisibility[overlay.kind]),
    [overlayVisibility, overlays],
  );

  const pointerToRoom = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }
    const x = ((clientX - rect.left) / rect.width) * plan.room.width;
    const y = ((clientY - rect.top) / rect.height) * plan.room.height;
    return { x, y };
  };

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const roomPoint = pointerToRoom(event.clientX, event.clientY);
      updateObjectPosition(
        dragState.objectId,
        roomPoint.x - dragState.offsetX,
        roomPoint.y - dragState.offsetY,
      );
    };

    const handlePointerUp = () => setDragState(null);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, updateObjectPosition, plan.room.width, plan.room.height]);

  const renderObject = (object: LayoutObject) => {
    const rect = getObjectRect(object);
    const severity = issueMap.get(object.id) ?? 'ok';
    const selected = object.id === selectedObjectId;
    const issueStyle = issueStyles[severity];

    return (
      <g
        key={object.id}
        onPointerDown={(event) => {
          event.stopPropagation();
          const roomPoint = pointerToRoom(event.clientX, event.clientY);
          setDragState({
            objectId: object.id,
            offsetX: roomPoint.x - rect.x,
            offsetY: roomPoint.y - rect.y,
          });
          selectObject(object.id);
        }}
        className="cursor-grab active:cursor-grabbing"
      >
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          rx={selected ? 18 : 14}
          fill={selected ? issueStyle.fill : object.fill}
          stroke={selected ? issueStyle.stroke : object.stroke}
          strokeWidth={selected ? 18 : 10}
        />
        <text
          x={rect.x + rect.width / 2}
          y={rect.y + rect.height / 2 - 40}
          textAnchor="middle"
          fontSize={180}
          fontWeight={700}
          fill="#0f172a"
        >
          {object.name}
        </text>
        <text
          x={rect.x + rect.width / 2}
          y={rect.y + rect.height / 2 + 150}
          textAnchor="middle"
          fontSize={150}
          fill="#475569"
        >
          {rect.width} x {rect.height} / {object.rotation}°
        </text>
        {object.seatCount > 0 ? (
          <text
            x={rect.x + rect.width - 120}
            y={rect.y + 180}
            textAnchor="end"
            fontSize={150}
            fontWeight={700}
            fill="#0f172a"
          >
            {object.seatCount}席
          </text>
        ) : null}
      </g>
    );
  };

  const renderOverlay = (overlay: PlanOverlay) => {
    const palette = overlayStyles[overlay.kind];
    const severityStyle = issueStyles[overlay.severity];
    const stroke = overlay.severity === 'ok' ? palette.stroke : severityStyle.stroke;
    const fill = overlay.severity === 'ok' ? palette.fill : severityStyle.fill;

    return (
      <g key={overlay.id} pointerEvents="none">
        <rect
          x={overlay.rect.x}
          y={overlay.rect.y}
          width={overlay.rect.width}
          height={overlay.rect.height}
          fill={fill}
          stroke={stroke}
          strokeDasharray="60 36"
          strokeWidth={10}
          rx={24}
        />
        <text
          x={overlay.rect.x + 80}
          y={overlay.rect.y + 180}
          fontSize={120}
          fontWeight={700}
          fill={stroke}
        >
          {overlay.label}
        </text>
      </g>
    );
  };

  const verticalGridLines: number[] = [];
  for (let x = settings.gridSize; x < plan.room.width; x += settings.gridSize) {
    verticalGridLines.push(x);
  }

  const horizontalGridLines: number[] = [];
  for (let y = settings.gridSize; y < plan.room.height; y += settings.gridSize) {
    horizontalGridLines.push(y);
  }

  const roomRect = getRoomRect(plan.room);

  return (
    <section className="flex h-full flex-col rounded-3xl bg-panel p-4 shadow-panel">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">平面キャンバス</h2>
          <p className="mt-1 text-sm text-slate-500">
            壁面スナップ、扉、ゾーン、評価色分けを反映します。
          </p>
        </div>
        <div className="flex max-w-[60%] flex-col items-end gap-2">
          <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
            1マス {settings.gridSize}mm
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {overlayOrder.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => toggleOverlay(kind)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  overlayVisibility[kind]
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                {overlayStyles[kind].label} {overlayCounts[kind]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-hidden rounded-3xl bg-slate-200/60">
        <div
          className="absolute inset-0 flex items-center justify-center p-2"
          onPointerDown={() => selectObject(null)}
        >
          <svg
            id="office-layout-canvas"
            ref={svgRef}
            width={plan.room.width * scale}
            height={plan.room.height * scale}
            viewBox={`0 0 ${plan.room.width} ${plan.room.height}`}
            className="rounded-2xl bg-white shadow-sm"
          >
            <rect x={0} y={0} width={roomRect.width} height={roomRect.height} fill="#fffefb" />
            {verticalGridLines.map((x) => (
              <line
                key={`vx-${x}`}
                x1={x}
                y1={0}
                x2={x}
                y2={plan.room.height}
                stroke="#e2e8f0"
                strokeWidth={10}
              />
            ))}
            {horizontalGridLines.map((y) => (
              <line
                key={`hy-${y}`}
                x1={0}
                y1={y}
                x2={plan.room.width}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth={10}
              />
            ))}

            {plan.zones.map((zone) => (
              <g key={zone.id}>
                <rect
                  x={zone.rect.x}
                  y={zone.rect.y}
                  width={zone.rect.width}
                  height={zone.rect.height}
                  rx={28}
                  fill={zone.color}
                  opacity={0.18}
                  stroke={zoneStroke[zone.type]}
                  strokeDasharray="80 40"
                  strokeWidth={14}
                />
                <text
                  x={zone.rect.x + 120}
                  y={zone.rect.y + 220}
                  fontSize={170}
                  fontWeight={700}
                  fill={zoneStroke[zone.type]}
                >
                  {zone.name}
                </text>
              </g>
            ))}

            {visibleOverlays.map(renderOverlay)}

            {plan.room.doors.map((door) => {
              const rect = getDoorRect(door, plan.room);
              return (
                <g key={door.id}>
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    fill="#fef3c7"
                    stroke="#ca8a04"
                    strokeWidth={10}
                  />
                  <text
                    x={rect.x + rect.width / 2}
                    y={rect.y + rect.height / 2 + 60}
                    textAnchor="middle"
                    fontSize={120}
                    fontWeight={700}
                    fill="#92400e"
                  >
                    {door.name}
                  </text>
                </g>
              );
            })}

            <rect
              x={0}
              y={0}
              width={plan.room.width}
              height={plan.room.height}
              fill="transparent"
              stroke="#0f172a"
              strokeWidth={plan.room.wallThickness / 2}
              rx={30}
            />
            {plan.objects.map(renderObject)}
          </svg>
        </div>
        <div className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
          初期レイアウト検討用の簡易判定
        </div>
      </div>
    </section>
  );
};
