import { useRef, useState, useCallback, useEffect } from "react";
import type { Fixture, FixtureType, PipeRoute } from "../domain/types";
import { structuralFixtureTypes } from "../domain/types";
import {
  fixtureLabels,
  fixtureColors,
  fixtureDrainSpec,
} from "../domain/rules/fixtureDefaults";
import { pipeColors, pipeTypeLabels } from "../domain/rules/pipeSpecs";
import { snapToGrid } from "../utils/geometry";

const DEFAULT_CANVAS_W = 8000; // mm
const DEFAULT_CANVAS_H = 6000; // mm
const MIN_SCALE = 0.05;
const MAX_SCALE = 0.5;
const ZOOM_STEP = 0.02;

/** リサイズハンドル位置 */
type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type Props = {
  fixtures: Fixture[];
  pipeRoutes: PipeRoute[];
  selectedFixtureId: string | null;
  /** 細線の間隔(mm) = moduleMm / gridDivision で算出済み */
  gridSizeMm: number;
  /** モジュールを何分割するか。gridDivision本ごとに太線を描画する。 */
  gridDivision: number;
  placingType: FixtureType | null;
  onAddFixture: (type: FixtureType, x: number, y: number) => void;
  onMoveFixture: (id: string, x: number, y: number) => void;
  onSelectFixture: (id: string | null) => void;
  onDeleteFixture?: (id: string) => void;
  onRotateFixture?: (id: string) => void;
  /** リサイズ確定: 位置と寸法を一括更新 */
  onResizeFixtureGeometry?: (id: string, x: number, y: number, w: number, h: number) => void;
};

export function GridCanvas({
  fixtures,
  pipeRoutes,
  selectedFixtureId,
  gridSizeMm,
  gridDivision,
  placingType,
  onAddFixture,
  onMoveFixture,
  onSelectFixture,
  onDeleteFixture,
  onRotateFixture,
  onResizeFixtureGeometry,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.14);
  const [dragging, setDragging] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  // リサイズドラッグ中の状態（開始位置・元の幾何情報・どのハンドル）
  const [resizing, setResizing] = useState<{
    id: string;
    handle: ResizeHandle;
    startMouseX: number;
    startMouseY: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  const canvasW = DEFAULT_CANVAS_W;
  const canvasH = DEFAULT_CANVAS_H;

  function mmToPx(mm: number) {
    return mm * scale;
  }

  const svgWidth = mmToPx(canvasW);
  const svgHeight = mmToPx(canvasH);

  /** SVG座標系でのマウス位置(mm)を取得 */
  const getMouseMm = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      return { x, y };
    },
    [scale]
  );

  // --- キーボードショートカット ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // テキスト入力中はスキップ
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (selectedFixtureId) {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          onDeleteFixture?.(selectedFixtureId);
        } else if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          onRotateFixture?.(selectedFixtureId);
        } else if (e.key === "Escape") {
          onSelectFixture(null);
        }
      } else if (e.key === "Escape" && placingType) {
        // 配置モードをキャンセル（親でハンドル）
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedFixtureId, placingType, onDeleteFixture, onRotateFixture, onSelectFixture]);

  // --- ズーム（マウスホイール） ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setScale((prev) => {
          const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
          return Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta));
        });
      }
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) return;
      if (placingType) {
        const pos = getMouseMm(e);
        onAddFixture(placingType, pos.x, pos.y);
        return;
      }
      // 空白クリックで選択解除
      const target = e.target as Element;
      const isFixtureRect = target.getAttribute("data-fixture") ||
        target.closest("[data-fixture]");
      if (!isFixtureRect) {
        onSelectFixture(null);
      }
    },
    [placingType, dragging, getMouseMm, onAddFixture, onSelectFixture]
  );

  const handleFixtureMouseDown = useCallback(
    (e: React.MouseEvent, fixture: Fixture) => {
      e.stopPropagation();
      onSelectFixture(fixture.id);
      if (placingType) return;
      const pos = getMouseMm(e);
      setDragging({
        id: fixture.id,
        offsetX: pos.x - fixture.x,
        offsetY: pos.y - fixture.y,
      });
    },
    [getMouseMm, onSelectFixture, placingType]
  );

  /** リサイズハンドルmousedown */
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, fixture: Fixture, handle: ResizeHandle) => {
      e.stopPropagation();
      const pos = getMouseMm(e);
      setResizing({
        id: fixture.id,
        handle,
        startMouseX: pos.x,
        startMouseY: pos.y,
        startX: fixture.x,
        startY: fixture.y,
        startW: fixture.w,
        startH: fixture.h,
      });
    },
    [getMouseMm]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // リサイズ中の処理を優先
      if (resizing && onResizeFixtureGeometry) {
        const pos = getMouseMm(e);
        const dx = pos.x - resizing.startMouseX;
        const dy = pos.y - resizing.startMouseY;
        let newX = resizing.startX;
        let newY = resizing.startY;
        let newW = resizing.startW;
        let newH = resizing.startH;
        const minSize = 50;

        // ハンドルに応じてx,y,w,hを計算
        const h = resizing.handle;
        if (h === "e" || h === "ne" || h === "se") {
          newW = Math.max(minSize, resizing.startW + dx);
        }
        if (h === "w" || h === "nw" || h === "sw") {
          // 左方向は xも動く（中央が動かないように右端を保持）
          const right = resizing.startX + resizing.startW;
          newX = Math.min(right - minSize, resizing.startX + dx);
          newW = right - newX;
        }
        if (h === "s" || h === "se" || h === "sw") {
          newH = Math.max(minSize, resizing.startH + dy);
        }
        if (h === "n" || h === "ne" || h === "nw") {
          const bottom = resizing.startY + resizing.startH;
          newY = Math.min(bottom - minSize, resizing.startY + dy);
          newH = bottom - newY;
        }
        onResizeFixtureGeometry(resizing.id, newX, newY, newW, newH);
        return;
      }
      if (!dragging) return;
      const pos = getMouseMm(e);
      const newX = snapToGrid(pos.x - dragging.offsetX, gridSizeMm);
      const newY = snapToGrid(pos.y - dragging.offsetY, gridSizeMm);
      onMoveFixture(dragging.id, newX, newY);
    },
    [dragging, resizing, getMouseMm, gridSizeMm, onMoveFixture, onResizeFixtureGeometry]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setResizing(null);
  }, []);

  /**
   * グリッド線生成
   * - 太線 (moduleMm) ごと
   * - 細線 (moduleMm / gridDivision) ごと（gridSizeMm）
   * インデックスベースで描画して浮動小数誤差を回避する。
   * iが gridDivision の倍数なら太線（モジュール境界）。
   */
  const gridLines: JSX.Element[] = [];
  // 描画範囲のモジュール境界数 + 余裕分
  const maxIxX = Math.ceil(canvasW / gridSizeMm);
  const maxIxY = Math.ceil(canvasH / gridSizeMm);

  for (let i = 0; i <= maxIxX; i++) {
    const xMm = i * gridSizeMm;
    if (xMm > canvasW + gridSizeMm) break;
    const isMajor = i % gridDivision === 0;
    gridLines.push(
      <line
        key={`gv-${i}`}
        x1={mmToPx(xMm)}
        y1={0}
        x2={mmToPx(xMm)}
        y2={svgHeight}
        stroke={isMajor ? "#888" : "#e0e0e0"}
        strokeWidth={isMajor ? 1.2 : 0.5}
      />
    );
  }
  for (let i = 0; i <= maxIxY; i++) {
    const yMm = i * gridSizeMm;
    if (yMm > canvasH + gridSizeMm) break;
    const isMajor = i % gridDivision === 0;
    gridLines.push(
      <line
        key={`gh-${i}`}
        x1={0}
        y1={mmToPx(yMm)}
        x2={svgWidth}
        y2={mmToPx(yMm)}
        stroke={isMajor ? "#888" : "#e0e0e0"}
        strokeWidth={isMajor ? 1.2 : 0.5}
      />
    );
  }

  return (
    <div ref={containerRef}>
      {/* ズームコントロール */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, fontSize: 12 }}>
        <button
          onClick={() => setScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP * 2))}
          style={{ padding: "2px 8px", cursor: "pointer", fontSize: 14 }}
          title="ズームアウト"
        >
          -
        </button>
        <span style={{ minWidth: 50, textAlign: "center" }}>
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP * 2))}
          style={{ padding: "2px 8px", cursor: "pointer", fontSize: 14 }}
          title="ズームイン"
        >
          +
        </button>
        <button
          onClick={() => setScale(0.14)}
          style={{ padding: "2px 8px", cursor: "pointer", fontSize: 11 }}
          title="リセット"
        >
          100%
        </button>
        <span style={{ color: "#999", fontSize: 11, marginLeft: 8 }}>
          Ctrl+ホイールでズーム / Del:削除 / R:回転
        </span>
      </div>

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

        {/* 構造・図面参照要素（背面レイヤー） */}
        {fixtures
          .filter((f) => structuralFixtureTypes.has(f.type))
          .map((f) => {
            const isSelected = f.id === selectedFixtureId;
            const color = fixtureColors[f.type];
            const isBeam = f.type === "beam";
            const isColumn = f.type === "column";

            return (
              <g
                key={f.id}
                data-fixture="true"
                style={{ cursor: "move" }}
                onMouseDown={(e) => handleFixtureMouseDown(e, f)}
              >
                <rect
                  x={mmToPx(f.x)}
                  y={mmToPx(f.y)}
                  width={mmToPx(f.w)}
                  height={mmToPx(f.h)}
                  fill={color === "transparent" ? "none" : color}
                  stroke={
                    isSelected
                      ? "#1976d2"
                      : isBeam
                      ? "#666"
                      : isColumn
                      ? "#212121"
                      : "#999"
                  }
                  strokeWidth={isSelected ? 2.5 : isBeam ? 1.5 : 1}
                  strokeDasharray={isBeam ? "6 3" : undefined}
                  rx={isColumn ? 0 : 1}
                  opacity={f.type === "wall" ? 0.6 : 1}
                />
                <text
                  x={mmToPx(f.x + f.w / 2)}
                  y={mmToPx(f.y + f.h / 2)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={isColumn ? 9 : 10}
                  fill={isColumn ? "#fff" : "#666"}
                  pointerEvents="none"
                >
                  {fixtureLabels[f.type]}
                </text>
              </g>
            );
          })}

        {/* 配管ルート（管種ごとにオフセットして表示） */}
        {pipeRoutes.map((route, i) => {
          const sameFixtureRoutes = pipeRoutes.filter(
            (r) => r.fixtureId === route.fixtureId
          );
          const indexInGroup = sameFixtureRoutes.indexOf(route);
          const offset = (indexInGroup - (sameFixtureRoutes.length - 1) / 2) * 3;

          const pts = route.points
            .map((p) => `${mmToPx(p.x) + offset},${mmToPx(p.y) + offset}`)
            .join(" ");

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

        {/* 設備→PS 距離ラベル */}
        {(() => {
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

        {/* 設備（構造要素は背面に別途描画済みのため除外） */}
        {fixtures
          .filter((f) => !structuralFixtureTypes.has(f.type))
          .map((f) => {
          const isSelected = f.id === selectedFixtureId;
          const color = fixtureColors[f.type];
          return (
            <g key={f.id}>
            <g
              data-fixture="true"
              style={{ cursor: "move" }}
              onMouseDown={(e) => handleFixtureMouseDown(e, f)}
            >
              <rect
                x={mmToPx(f.x)}
                y={mmToPx(f.y)}
                width={mmToPx(f.w)}
                height={mmToPx(f.h)}
                fill={color}
                stroke={isSelected ? "#1976d2" : f.type === "ps" ? "#e65100" : "#666"}
                strokeWidth={isSelected ? 2.5 : 1}
                rx={2}
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
              {/* 排水溝（水回り設備のみ） */}
              {(() => {
                const drain = fixtureDrainSpec[f.type];
                if (!drain) return null;
                const cxMm = f.x + f.w * drain.ratioX;
                const cyMm = f.y + f.h * drain.ratioY;
                const rPx = mmToPx(drain.diameterMm / 2);
                return (
                  <g pointerEvents="none">
                    <circle
                      cx={mmToPx(cxMm)}
                      cy={mmToPx(cyMm)}
                      r={rPx}
                      fill="rgba(255,255,255,0.6)"
                      stroke="#1e88e5"
                      strokeWidth={1.2}
                    />
                    {/* 排水口を示すクロスマーク */}
                    <line
                      x1={mmToPx(cxMm) - rPx * 0.6}
                      y1={mmToPx(cyMm)}
                      x2={mmToPx(cxMm) + rPx * 0.6}
                      y2={mmToPx(cyMm)}
                      stroke="#1e88e5"
                      strokeWidth={0.8}
                    />
                    <line
                      x1={mmToPx(cxMm)}
                      y1={mmToPx(cyMm) - rPx * 0.6}
                      x2={mmToPx(cxMm)}
                      y2={mmToPx(cyMm) + rPx * 0.6}
                      stroke="#1e88e5"
                      strokeWidth={0.8}
                    />
                  </g>
                );
              })()}
            </g>
            {/* リサイズハンドル（選択中のみ） */}
            {isSelected && (() => {
              const handleSizePx = 8;
              const handleHalf = handleSizePx / 2;
              const xPx = mmToPx(f.x);
              const yPx = mmToPx(f.y);
              const wPx = mmToPx(f.w);
              const hPx = mmToPx(f.h);
              const handles: { key: ResizeHandle; cx: number; cy: number; cursor: string }[] = [
                { key: "nw", cx: xPx, cy: yPx, cursor: "nwse-resize" },
                { key: "n",  cx: xPx + wPx / 2, cy: yPx, cursor: "ns-resize" },
                { key: "ne", cx: xPx + wPx, cy: yPx, cursor: "nesw-resize" },
                { key: "e",  cx: xPx + wPx, cy: yPx + hPx / 2, cursor: "ew-resize" },
                { key: "se", cx: xPx + wPx, cy: yPx + hPx, cursor: "nwse-resize" },
                { key: "s",  cx: xPx + wPx / 2, cy: yPx + hPx, cursor: "ns-resize" },
                { key: "sw", cx: xPx, cy: yPx + hPx, cursor: "nesw-resize" },
                { key: "w",  cx: xPx, cy: yPx + hPx / 2, cursor: "ew-resize" },
              ];
              return handles.map((h) => (
                <rect
                  key={`handle-${h.key}`}
                  x={h.cx - handleHalf}
                  y={h.cy - handleHalf}
                  width={handleSizePx}
                  height={handleSizePx}
                  fill="#fff"
                  stroke="#1976d2"
                  strokeWidth={1.5}
                  style={{ cursor: h.cursor }}
                  onMouseDown={(e) => handleResizeMouseDown(e, f, h.key)}
                />
              ));
            })()}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
