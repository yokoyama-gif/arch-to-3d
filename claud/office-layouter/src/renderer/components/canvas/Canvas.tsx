import React, { useMemo, useRef, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { evaluate } from "../../logic/evaluation";
import { objectAABB } from "../../logic/geometry/rect";
import type { LayoutObject } from "../../models/types";

const PADDING = 40; // px

export const Canvas: React.FC = () => {
  const project = useProjectStore((s) => s.project);
  const plan = project.plans.find((p) => p.id === project.activePlanId)!;
  const selectedId = useProjectStore((s) => s.selectedObjectId);
  const selectObject = useProjectStore((s) => s.selectObject);
  const moveObject = useProjectStore((s) => s.moveObject);

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  React.useEffect(() => {
    const obs = new ResizeObserver(() => {
      const el = containerRef.current;
      if (el) setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // 表示スケール (mm -> px)
  const scale = useMemo(() => {
    const sx = (size.w - PADDING * 2) / plan.room.width;
    const sy = (size.h - PADDING * 2) / plan.room.height;
    return Math.max(0.005, Math.min(sx, sy));
  }, [size, plan.room.width, plan.room.height]);

  const result = useMemo(() => evaluate(plan, project.settings), [plan, project.settings]);
  const objectsWithIssues = useMemo(() => {
    const sevById: Record<string, "ok" | "warn" | "ng"> = {};
    for (const issue of result.issues) {
      if (!issue.objectId) continue;
      const cur = sevById[issue.objectId];
      if (issue.severity === "ng" || cur !== "ng") sevById[issue.objectId] = issue.severity;
    }
    return sevById;
  }, [result.issues]);

  // ドラッグ
  const dragState = useRef<null | { id: string; offX: number; offY: number }>(null);

  const onMouseDown = (e: React.MouseEvent, obj: LayoutObject) => {
    e.stopPropagation();
    selectObject(obj.id);
    const svg = (e.currentTarget as SVGElement).ownerSVGElement!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());
    dragState.current = { id: obj.id, offX: p.x - obj.x, offY: p.y - obj.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragState.current) return;
    const svg = e.currentTarget as SVGSVGElement;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());
    moveObject(dragState.current.id, p.x - dragState.current.offX, p.y - dragState.current.offY);
  };

  const onMouseUp = () => {
    dragState.current = null;
  };

  const grid = project.settings.gridSize;
  const showGrid = project.settings.showGrid;

  // SVG viewBox: そのまま mm 座標で扱う
  const viewBoxW = size.w / scale;
  const viewBoxH = size.h / scale;
  const offsetX = (viewBoxW - plan.room.width) / 2;
  const offsetY = (viewBoxH - plan.room.height) / 2;

  return (
    <div ref={containerRef} className="flex-1 relative bg-slate-100 overflow-hidden">
      <svg
        width={size.w}
        height={size.h}
        viewBox={`${-offsetX} ${-offsetY} ${viewBoxW} ${viewBoxH}`}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={() => selectObject(null)}
      >
        {/* 部屋 */}
        <rect
          x={0}
          y={0}
          width={plan.room.width}
          height={plan.room.height}
          fill="white"
          stroke="#0f172a"
          strokeWidth={20 / scale}
        />
        {/* グリッド */}
        {showGrid && (
          <g pointerEvents="none">
            {Array.from({ length: Math.ceil(plan.room.width / grid) + 1 }).map((_, i) => (
              <line
                key={`v${i}`}
                x1={i * grid}
                y1={0}
                x2={i * grid}
                y2={plan.room.height}
                stroke="#e2e8f0"
                strokeWidth={1 / scale}
              />
            ))}
            {Array.from({ length: Math.ceil(plan.room.height / grid) + 1 }).map((_, i) => (
              <line
                key={`h${i}`}
                x1={0}
                y1={i * grid}
                x2={plan.room.width}
                y2={i * grid}
                stroke="#e2e8f0"
                strokeWidth={1 / scale}
              />
            ))}
          </g>
        )}
        {/* オブジェクト */}
        {plan.objects.map((obj) => {
          const aabb = objectAABB(obj);
          const sev = objectsWithIssues[obj.id];
          const isSelected = obj.id === selectedId;
          const fill =
            sev === "ng"
              ? "#fee2e2"
              : sev === "warn"
                ? "#fef9c3"
                : isSeating(obj)
                  ? "#dbeafe"
                  : "#e2e8f0";
          const stroke =
            sev === "ng"
              ? "#dc2626"
              : sev === "warn"
                ? "#ca8a04"
                : isSelected
                  ? "#2563eb"
                  : "#475569";
          return (
            <g
              key={obj.id}
              onMouseDown={(e) => onMouseDown(e, obj)}
              onClick={(e) => {
                e.stopPropagation();
                selectObject(obj.id);
              }}
              style={{ cursor: "move" }}
            >
              <rect
                x={aabb.x}
                y={aabb.y}
                width={aabb.width}
                height={aabb.height}
                fill={fill}
                stroke={stroke}
                strokeWidth={(isSelected ? 4 : 2) / scale}
              />
              {/* 向きマーカー (前方を示す小三角) */}
              {renderFrontMarker(obj, aabb, scale)}
              <text
                x={aabb.x + aabb.width / 2}
                y={aabb.y + aabb.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={Math.min(aabb.width, aabb.height) / 6}
                fill="#0f172a"
                pointerEvents="none"
              >
                {obj.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-1 left-1 text-[10px] text-slate-500 bg-white/70 px-1.5 py-0.5 rounded">
        初期レイアウト検討用の簡易判定 ({plan.room.width}×{plan.room.height}mm)
      </div>
    </div>
  );
};

function isSeating(obj: LayoutObject): boolean {
  return !!obj.seats && obj.seats > 0;
}

function renderFrontMarker(
  obj: LayoutObject,
  aabb: { x: number; y: number; width: number; height: number },
  scale: number,
) {
  const cx = aabb.x + aabb.width / 2;
  const cy = aabb.y + aabb.height / 2;
  const len = Math.min(aabb.width, aabb.height) / 4;
  let x = cx;
  let y = cy;
  switch (obj.rotation) {
    case 0:
      y = aabb.y + aabb.height - len * 0.4;
      break;
    case 90:
      x = aabb.x + aabb.width - len * 0.4;
      break;
    case 180:
      y = aabb.y + len * 0.4;
      break;
    case 270:
      x = aabb.x + len * 0.4;
      break;
  }
  return (
    <circle
      cx={x}
      cy={y}
      r={len * 0.3}
      fill="#2563eb"
      opacity={0.6}
      pointerEvents="none"
      strokeWidth={1 / scale}
    />
  );
}
