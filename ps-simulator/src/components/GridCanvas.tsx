import { useRef, useState, useCallback } from "react";
import type { Fixture, FixtureType, PipeRoute } from "../domain/types";
import { fixtureLabels, fixtureColors } from "../domain/rules/fixtureDefaults";
import { pipeColors, pipeTypeLabels } from "../domain/rules/pipeSpecs";
import { snapToGrid } from "../utils/geometry";

const CANVAS_W = 6000; // mm
const CANVAS_H = 5000; // mm
const SCALE = 0.14; // mm → px 変換

function mmToPx(mm: number) {
  return mm * SCALE;
}

type Props = {
  fixtures: Fixture[];
  pipeRoutes: PipeRoute[];
  selectedFixtureId: string | null;
  gridSizeMm: number;
  placingType: FixtureType | null;
  onAddFixture: (type: FixtureType, x: number, y: number) => void;
  onMoveFixture: (id: string, x: number, y: number) => void;
  onSelectFixture: (id: string | null) => void;
};

export function GridCanvas({
  fixtures,
  pipeRoutes,
  selectedFixtureId,
  gridSizeMm,
  placingType,
  onAddFixture,
  onMoveFixture,
  onSelectFixture,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const svgWidth = mmToPx(CANVAS_W);
  const svgHeight = mmToPx(CANVAS_H);

  /** SVG座標系でのマウス位置(mm)を取得 */
  const getMouseMm = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left) / SCALE;
      const y = (e.clientY - rect.top) / SCALE;
      return { x, y };
    },
    []
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) return;
      if (placingType) {
        const pos = getMouseMm(e);
        onAddFixture(placingType, pos.x, pos.y);
        return;
      }
      // 空白クリックで選択解除
      if ((e.target as Element).tagName === "svg" || (e.target as Element).tagName === "rect") {
        // グリッド背景のrectや直接SVGをクリックした場合
        const isFixtureRect = (e.target as Element).getAttribute("data-fixture");
        if (!isFixtureRect) {
          onSelectFixture(null);
        }
      }
    },
    [placingType, dragging, getMouseMm, onAddFixture, onSelectFixture]
  );

  const handleFixtureMouseDown = useCallback(
    (e: React.MouseEvent, fixture: Fixture) => {
      e.stopPropagation();
      onSelectFixture(fixture.id);
      if (placingType) return; // 配置モード中はドラッグしない
      const pos = getMouseMm(e);
      setDragging({
        id: fixture.id,
        offsetX: pos.x - fixture.x,
        offsetY: pos.y - fixture.y,
      });
    },
    [getMouseMm, onSelectFixture, placingType]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const pos = getMouseMm(e);
      const newX = snapToGrid(pos.x - dragging.offsetX, gridSizeMm);
      const newY = snapToGrid(pos.y - dragging.offsetY, gridSizeMm);
      onMoveFixture(dragging.id, newX, newY);
    },
    [dragging, getMouseMm, gridSizeMm, onMoveFixture]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  // グリッド線
  const gridLines: JSX.Element[] = [];
  for (let x = 0; x <= CANVAS_W; x += gridSizeMm) {
    gridLines.push(
      <line
        key={`gv-${x}`}
        x1={mmToPx(x)}
        y1={0}
        x2={mmToPx(x)}
        y2={svgHeight}
        stroke="#e0e0e0"
        strokeWidth={0.5}
      />
    );
  }
  for (let y = 0; y <= CANVAS_H; y += gridSizeMm) {
    gridLines.push(
      <line
        key={`gh-${y}`}
        x1={0}
        y1={mmToPx(y)}
        x2={svgWidth}
        y2={mmToPx(y)}
        stroke="#e0e0e0"
        strokeWidth={0.5}
      />
    );
  }

  return (
    <svg
      ref={svgRef}
      width={svgWidth}
      height={svgHeight}
      style={{
        background: "#fff",
        border: "1px solid #ccc",
        cursor: placingType ? "crosshair" : "default",
      }}
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* グリッド */}
      {gridLines}

      {/* 配管ルート（管種ごとにオフセットして表示） */}
      {pipeRoutes.map((route, i) => {
        // 同一設備の配管をオフセットして見やすくする
        const sameFixtureRoutes = pipeRoutes.filter(
          (r) => r.fixtureId === route.fixtureId
        );
        const indexInGroup = sameFixtureRoutes.indexOf(route);
        const offset = (indexInGroup - (sameFixtureRoutes.length - 1) / 2) * 3;

        const pts = route.points
          .map((p) => `${mmToPx(p.x) + offset},${mmToPx(p.y) + offset}`)
          .join(" ");

        // ラベル位置: ルート中間セグメントの中点
        const midIdx = Math.floor(route.points.length / 2);
        const p0 = route.points[midIdx - 1] ?? route.points[0];
        const p1 = route.points[midIdx] ?? route.points[0];
        const labelX = mmToPx((p0.x + p1.x) / 2) + offset;
        const labelY = mmToPx((p0.y + p1.y) / 2) + offset - 4;

        return (
          <g key={`route-${i}`}>
            <polyline
              points={pts}
              fill="none"
              stroke={pipeColors[route.pipeType] ?? "#999"}
              strokeWidth={2}
              strokeDasharray={route.pipeType === "vent" ? "4 2" : undefined}
              opacity={0.7}
            />
            {/* 管種ラベル */}
            <rect
              x={labelX - 14}
              y={labelY - 8}
              width={28}
              height={12}
              rx={2}
              fill="rgba(255,255,255,0.9)"
              pointerEvents="none"
            />
            <text
              x={labelX}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={8}
              fill={pipeColors[route.pipeType] ?? "#999"}
              pointerEvents="none"
              fontWeight={700}
            >
              {pipeTypeLabels[route.pipeType]}
            </text>
          </g>
        );
      })}

      {/* 設備→PS 距離ラベル（設備ごとに1つ） */}
      {(() => {
        // 設備IDごとに最初のルートだけ使って距離表示
        const shown = new Set<string>();
        return pipeRoutes
          .filter((r) => {
            if (shown.has(r.fixtureId)) return false;
            shown.add(r.fixtureId);
            return true;
          })
          .map((route) => {
            const fixture = fixtures.find((f) => f.id === route.fixtureId);
            if (!fixture) return null;
            const cx = mmToPx(fixture.x + fixture.w / 2);
            const bottom = mmToPx(fixture.y + fixture.h);
            const distM = (route.lengthMm / 1000).toFixed(1);
            const labelW = 68;
            const labelH = 18;
            return (
              <g key={`dist-${route.fixtureId}`}>
                <rect
                  x={cx - labelW / 2}
                  y={bottom + 2}
                  width={labelW}
                  height={labelH}
                  rx={3}
                  fill="rgba(33,33,33,0.85)"
                  pointerEvents="none"
                />
                <text
                  x={cx}
                  y={bottom + 2 + labelH / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  fill="#fff"
                  fontWeight={600}
                  pointerEvents="none"
                >
                  →PS {distM}m
                </text>
              </g>
            );
          });
      })()}

      {/* 設備 */}
      {fixtures.map((f) => {
        const isSelected = f.id === selectedFixtureId;
        const color = fixtureColors[f.type];
        return (
          <g key={f.id}>
            <rect
              data-fixture="true"
              x={mmToPx(f.x)}
              y={mmToPx(f.y)}
              width={mmToPx(f.w)}
              height={mmToPx(f.h)}
              fill={color}
              stroke={isSelected ? "#1976d2" : f.type === "ps" ? "#e65100" : "#666"}
              strokeWidth={isSelected ? 2.5 : 1}
              rx={2}
              style={{ cursor: "move" }}
              onMouseDown={(e) => handleFixtureMouseDown(e, f)}
            />
            <text
              x={mmToPx(f.x + f.w / 2)}
              y={mmToPx(f.y + f.h / 2)}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
              fill="#333"
              fontWeight={f.type === "ps" ? 700 : 400}
              pointerEvents="none"
            >
              {fixtureLabels[f.type]}
            </text>
            {/* 寸法表示 */}
            <text
              x={mmToPx(f.x + f.w / 2)}
              y={mmToPx(f.y + f.h / 2) + 13}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={8}
              fill="#666"
              pointerEvents="none"
            >
              {f.w}×{f.h}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
