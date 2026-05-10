import React from 'react';
import type { Drawing, InputState, Point, Shape, ToolId } from '../types/drawing';
import { computeDimensionGeometry, formatDimensionText } from '../utils/dimensions';
import { bbox } from '../utils/geometry';
import { snapToGrid } from '../utils/snap';
import { hitTest } from '../utils/hitTest';
import {
  DEFAULT_COMPASS_RADIUS_MM,
  DEFAULT_DIMENSION_OFFSET_MM,
  DEFAULT_ROAD_WIDTH_MM,
  moveShape,
} from '../utils/shapeOps';
import { generateAutoDimensions } from '../utils/autoDimensions';
import { buildingCorners } from '../utils/buildingGeometry';

interface Props {
  drawing: Drawing;
  tool: ToolId;
  inputState: InputState;
  selectedId: string | null;
  showAutoDimensions?: boolean;
  onCursorChange?: (mm: Point | null) => void;
  onCanvasClick: (mm: Point) => void;
  onCanvasContextMenu: () => void;
  onShapeClick: (id: string) => void;
  onShapeDragEnd: (id: string, dxMM: number, dyMM: number) => void;
  onShapeDelete: (id: string) => void;
}

export interface CadCanvasHandle {
  fitAll: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

const FINE_GRID_MM   = 1000;
const COARSE_GRID_MM = 5000;
const PADDING_MM     = 4000;
const SNAP_GRID_MM   = 1000;
const DRAG_THRESHOLD_MM = 200;

const PX_PER_MM_MIN = 0.002;   // 1m=2px (≈ 1/5000 表示)
const PX_PER_MM_MAX = 0.5;     // 1m=500px (≈ 1/2 表示)
const ZOOM_FACTOR   = 1.2;

type DragLocal =
  | { kind: 'none' }
  | { kind: 'pending'; id: string; startMM: Point }
  | { kind: 'dragging'; id: string; startMM: Point; currentMM: Point };

type PanLocal =
  | { kind: 'none' }
  | { kind: 'panning'; startScreen: Point; startCenter: Point };

function collectPoints(shapes: Shape[]): Point[] {
  const all: Point[] = [];
  for (const s of shapes) {
    switch (s.type) {
      case 'site':       all.push(...s.points); break;
      case 'road':       all.push(...s.centerLine); break;
      case 'building':   {
        const { origin: o, width: w, depth: d } = s;
        all.push({ x: o.x, y: o.y }, { x: o.x + w, y: o.y + d });
        break;
      }
      case 'dimension':  all.push(s.start, s.end); break;
      case 'compass':    all.push(
        { x: s.center.x - s.radius, y: s.center.y - s.radius },
        { x: s.center.x + s.radius, y: s.center.y + s.radius },
      ); break;
    }
  }
  return all;
}

export const CadCanvas = React.forwardRef<CadCanvasHandle, Props>(function CadCanvas(props, ref) {
  const {
    drawing, tool, inputState, selectedId, showAutoDimensions,
    onCursorChange, onCanvasClick, onCanvasContextMenu,
    onShapeClick, onShapeDragEnd, onShapeDelete,
  } = props;

  const wrapRef = React.useRef<HTMLDivElement>(null);
  const svgRef  = React.useRef<SVGSVGElement>(null);
  const [size, setSize] = React.useState({ w: 800, h: 600 });
  const [cursor, setCursor] = React.useState<Point | null>(null);
  const [drag, setDrag] = React.useState<DragLocal>({ kind: 'none' });
  const [pan, setPan]   = React.useState<PanLocal>({ kind: 'none' });

  // 初期ビュー（描画 bbox から）
  const initialDrawingRef = React.useRef(drawing);
  const initialView = React.useMemo(() => {
    const all = collectPoints(initialDrawingRef.current.shapes);
    if (all.length === 0) return { center: { x: 10000, y: 10000 }, pxPerMM: 0.04 };
    const b = bbox(all);
    const w = b.maxX - b.minX + PADDING_MM * 2;
    const h = b.maxY - b.minY + PADDING_MM * 2;
    return {
      center: { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 },
      pxPerMM: Math.min(800 / w, 600 / h),
    };
  }, []);

  const [centerMM, setCenterMM] = React.useState<Point>(initialView.center);
  const [pxPerMM,  setPxPerMM]  = React.useState<number>(initialView.pxPerMM);

  // 親サイズ取得 + 初回 fit
  const didInitialFitRef = React.useRef(false);
  React.useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const cr = e.contentRect;
        const newSize = { w: Math.max(100, cr.width), h: Math.max(100, cr.height) };
        setSize(newSize);
        if (!didInitialFitRef.current && newSize.w > 200) {
          didInitialFitRef.current = true;
          fitToShapes(initialDrawingRef.current.shapes, newSize);
        }
      }
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fitToShapes = React.useCallback((shapes: Shape[], sz?: { w: number; h: number }) => {
    const all = collectPoints(shapes);
    if (all.length === 0) return;
    const b = bbox(all);
    const w = b.maxX - b.minX + PADDING_MM * 2;
    const h = b.maxY - b.minY + PADDING_MM * 2;
    const s = sz ?? size;
    const newPxPerMM = Math.min(s.w / w, s.h / h);
    setPxPerMM(Math.max(PX_PER_MM_MIN, Math.min(PX_PER_MM_MAX, newPxPerMM)));
    setCenterMM({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });
  }, [size]);

  // 公開 API
  React.useImperativeHandle(ref, () => ({
    fitAll: () => fitToShapes(drawing.shapes),
    zoomIn: () => setPxPerMM(p => Math.min(PX_PER_MM_MAX, p * ZOOM_FACTOR)),
    zoomOut: () => setPxPerMM(p => Math.max(PX_PER_MM_MIN, p / ZOOM_FACTOR)),
    resetView: () => {
      setCenterMM(initialView.center);
      setPxPerMM(initialView.pxPerMM);
    },
  }), [drawing.shapes, fitToShapes, initialView]);

  // ===== 投影 =====
  const project = React.useCallback((p: Point) => ({
    x: size.w / 2 + (p.x - centerMM.x) * pxPerMM,
    y: size.h / 2 - (p.y - centerMM.y) * pxPerMM,
  }), [centerMM, pxPerMM, size]);

  const unproject = React.useCallback((sx: number, sy: number): Point => ({
    x: centerMM.x + (sx - size.w / 2) / pxPerMM,
    y: centerMM.y - (sy - size.h / 2) / pxPerMM,
  }), [centerMM, pxPerMM, size]);

  const getEventMM = (e: React.MouseEvent<SVGSVGElement>, snap = true): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    const raw = unproject(e.clientX - rect.left, e.clientY - rect.top);
    return snap ? snapToGrid(raw, SNAP_GRID_MM) : raw;
  };

  // 表示中 bbox（グリッド計算用）
  const visBbox = React.useMemo(() => {
    const halfW = size.w / 2 / pxPerMM;
    const halfH = size.h / 2 / pxPerMM;
    return {
      minX: centerMM.x - halfW,
      maxX: centerMM.x + halfW,
      minY: centerMM.y - halfH,
      maxY: centerMM.y + halfH,
    };
  }, [centerMM, pxPerMM, size]);

  // ===== ホイールでズーム（カーソル位置を中心に） =====
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const beforeMM = unproject(mx, my);
      const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      const newPxPerMM = Math.max(PX_PER_MM_MIN, Math.min(PX_PER_MM_MAX, pxPerMM * factor));
      if (newPxPerMM === pxPerMM) return;
      setPxPerMM(newPxPerMM);
      // カーソル下の世界点を保つ → 新中心を逆算
      setCenterMM({
        x: beforeMM.x - (mx - size.w / 2) / newPxPerMM,
        y: beforeMM.y + (my - size.h / 2) / newPxPerMM,
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [pxPerMM, size, unproject]);

  // ===== マウスイベント =====
  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    // パン中
    if (pan.kind === 'panning') {
      const dx = e.clientX - pan.startScreen.x;
      const dy = e.clientY - pan.startScreen.y;
      setCenterMM({
        x: pan.startCenter.x - dx / pxPerMM,
        y: pan.startCenter.y + dy / pxPerMM,
      });
      return;
    }
    const mm = getEventMM(e);
    setCursor(mm);
    onCursorChange?.(mm);

    if (drag.kind === 'pending') {
      const dx = mm.x - drag.startMM.x;
      const dy = mm.y - drag.startMM.y;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD_MM) {
        setDrag({ kind: 'dragging', id: drag.id, startMM: drag.startMM, currentMM: mm });
      }
    } else if (drag.kind === 'dragging') {
      setDrag({ ...drag, currentMM: mm });
    }
  };

  const onMouseLeave = () => {
    setCursor(null);
    onCursorChange?.(null);
    if (pan.kind === 'panning') setPan({ kind: 'none' });
  };

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // 中ボタン：パン開始
    if (e.button === 1) {
      e.preventDefault();
      setPan({ kind: 'panning', startScreen: { x: e.clientX, y: e.clientY }, startCenter: centerMM });
      return;
    }
    if (e.button !== 0) return;
    if (tool === 'select') {
      const mm = getEventMM(e);
      const hit = hitTest(mm, drawing.shapes);
      if (hit) {
        setDrag({ kind: 'pending', id: hit.id, startMM: mm });
        e.preventDefault();
      }
    }
  };

  const onMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    if (pan.kind === 'panning' && e.button === 1) { setPan({ kind: 'none' }); return; }
    if (e.button !== 0) return;
    if (drag.kind === 'dragging') {
      const dx = drag.currentMM.x - drag.startMM.x;
      const dy = drag.currentMM.y - drag.startMM.y;
      onShapeDragEnd(drag.id, dx, dy);
      setDrag({ kind: 'none' });
      return;
    }
    if (drag.kind === 'pending') setDrag({ kind: 'none' });
  };

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    if (pan.kind === 'panning') return;
    const mm = getEventMM(e);
    if (tool === 'select') {
      const hit = hitTest(mm, drawing.shapes);
      onShapeClick(hit ? hit.id : '');
      return;
    }
    if (tool === 'delete') {
      const hit = hitTest(mm, drawing.shapes);
      if (hit) onShapeDelete(hit.id);
      return;
    }
    onCanvasClick(mm);
  };

  const onContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    onCanvasContextMenu();
  };

  // ===== グリッド =====
  const gridLines = React.useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; coarse: boolean }[] = [];
    // 細グリッドが密になりすぎる縮尺では細を間引く
    const showFine = pxPerMM * FINE_GRID_MM >= 4;
    const startX = Math.floor(visBbox.minX / FINE_GRID_MM) * FINE_GRID_MM;
    const startY = Math.floor(visBbox.minY / FINE_GRID_MM) * FINE_GRID_MM;
    for (let x = startX; x <= visBbox.maxX; x += FINE_GRID_MM) {
      const coarse = Math.abs(x % COARSE_GRID_MM) < 0.001;
      if (!coarse && !showFine) continue;
      const a = project({ x, y: visBbox.minY });
      const b = project({ x, y: visBbox.maxY });
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, coarse });
    }
    for (let y = startY; y <= visBbox.maxY; y += FINE_GRID_MM) {
      const coarse = Math.abs(y % COARSE_GRID_MM) < 0.001;
      if (!coarse && !showFine) continue;
      const a = project({ x: visBbox.minX, y });
      const b = project({ x: visBbox.maxX, y });
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, coarse });
    }
    return lines;
  }, [visBbox, project, pxPerMM]);

  const cursorMap: Record<ToolId, string> = {
    select:    drag.kind === 'dragging' ? 'grabbing' : 'default',
    siteLine:  'crosshair',
    road:      'crosshair',
    building:  'crosshair',
    dimension: 'crosshair',
    compass:   'crosshair',
    delete:    'not-allowed',
  };
  const effectiveCursor = pan.kind === 'panning' ? 'grabbing' : cursorMap[tool];

  // ドラッグ中の図形を変形して表示
  const renderShapes: Shape[] = drawing.shapes.map(s => {
    if (drag.kind === 'dragging' && drag.id === s.id) {
      return moveShape(s, drag.currentMM.x - drag.startMM.x, drag.currentMM.y - drag.startMM.y);
    }
    return s;
  });

  // 入力プレビュー
  const renderInputPreview = () => {
    if (inputState.kind === 'site-drawing' && cursor) {
      const pts = [...inputState.points, cursor];
      if (pts.length < 2) {
        const p = project(pts[0]);
        return <circle cx={p.x} cy={p.y} r={3} fill="#a06000" />;
      }
      const d = pts.map((p, i) => {
        const sp = project(p);
        return `${i === 0 ? 'M' : 'L'}${sp.x},${sp.y}`;
      }).join(' ');
      const first = project(pts[0]);
      const last  = project(cursor);
      return (
        <g className="preview-site">
          <path d={d} fill="rgba(255, 230, 150, 0.18)" stroke="#a06000" strokeWidth={1.5} strokeDasharray="4 3" />
          <line x1={last.x} y1={last.y} x2={first.x} y2={first.y}
            stroke="#a06000" strokeWidth={1} strokeDasharray="2 4" opacity={0.6} />
          {inputState.points.map((p, i) => {
            const sp = project(p);
            return <circle key={i} cx={sp.x} cy={sp.y} r={3} fill="#a06000" />;
          })}
          <circle cx={last.x} cy={last.y} r={3} fill="#a06000" opacity={0.5} />
        </g>
      );
    }
    if (inputState.kind === 'building-corner2' && cursor) {
      const a = inputState.first;
      const b = cursor;
      const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
      const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
      const p1 = project({ x: x1, y: y2 });
      const w = (x2 - x1) * pxPerMM;
      const h = (y2 - y1) * pxPerMM;
      return (
        <g className="preview-building">
          <rect x={p1.x} y={p1.y} width={w} height={h}
            fill="rgba(120, 170, 220, 0.18)" stroke="#1f4e87"
            strokeWidth={1.5} strokeDasharray="4 3" />
          <text x={p1.x + w / 2} y={p1.y + h / 2} fontSize={11} fill="#1f4e87"
            textAnchor="middle" dominantBaseline="middle">
            {Math.round(x2 - x1)} × {Math.round(y2 - y1)} mm
          </text>
        </g>
      );
    }
    if (inputState.kind === 'road-point2' && cursor) {
      const a = inputState.first, b = cursor;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) return null;
      const nx = -dy / len, ny = dx / len;
      const half = DEFAULT_ROAD_WIDTH_MM / 2;
      const p1 = project({ x: a.x + nx * half, y: a.y + ny * half });
      const p2 = project({ x: b.x + nx * half, y: b.y + ny * half });
      const p3 = project({ x: b.x - nx * half, y: b.y - ny * half });
      const p4 = project({ x: a.x - nx * half, y: a.y - ny * half });
      const cA = project(a), cB = project(b);
      const mid = { x: (cA.x + cB.x) / 2, y: (cA.y + cB.y) / 2 };
      return (
        <g className="preview-road">
          <path d={`M${p1.x},${p1.y} L${p2.x},${p2.y} L${p3.x},${p3.y} L${p4.x},${p4.y} Z`}
            fill="rgba(136,136,136,0.18)" stroke="#666" strokeWidth={1.2} strokeDasharray="4 3" />
          <line x1={cA.x} y1={cA.y} x2={cB.x} y2={cB.y}
            stroke="#666" strokeWidth={1} strokeDasharray="6 4" />
          <text x={mid.x} y={mid.y - 6} fontSize={11} fill="#444" textAnchor="middle">
            L={Math.round(len)}mm / W={DEFAULT_ROAD_WIDTH_MM}mm
          </text>
        </g>
      );
    }
    if (inputState.kind === 'dimension-point2' && cursor) {
      const a = inputState.first, b = cursor;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) return null;
      const nx = -dy / len, ny = dx / len;
      const off = DEFAULT_DIMENSION_OFFSET_MM;
      const oA = project({ x: a.x + nx * off, y: a.y + ny * off });
      const oB = project({ x: b.x + nx * off, y: b.y + ny * off });
      const pA = project(a), pB = project(b);
      const mid = { x: (oA.x + oB.x) / 2, y: (oA.y + oB.y) / 2 };
      let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angleDeg > 90)  angleDeg -= 180;
      if (angleDeg < -90) angleDeg += 180;
      return (
        <g className="preview-dimension">
          <line x1={pA.x} y1={pA.y} x2={oA.x} y2={oA.y} stroke="#a01e1e" strokeWidth={0.8} strokeDasharray="3 2" />
          <line x1={pB.x} y1={pB.y} x2={oB.x} y2={oB.y} stroke="#a01e1e" strokeWidth={0.8} strokeDasharray="3 2" />
          <line x1={oA.x} y1={oA.y} x2={oB.x} y2={oB.y} stroke="#a01e1e" strokeWidth={1.0} />
          <circle cx={oA.x} cy={oA.y} r={2} fill="#a01e1e" />
          <circle cx={oB.x} cy={oB.y} r={2} fill="#a01e1e" />
          <text x={mid.x} y={mid.y - 4} fontSize={11} fill="#a01e1e" textAnchor="middle"
            transform={`rotate(${-angleDeg} ${mid.x} ${mid.y})`}>
            {Math.round(len)}
          </text>
        </g>
      );
    }
    if (inputState.kind === 'compass-place' && cursor) {
      const c = project(cursor);
      const r = DEFAULT_COMPASS_RADIUS_MM * pxPerMM;
      return (
        <g className="preview-compass" opacity={0.7}>
          <circle cx={c.x} cy={c.y} r={r} fill="rgba(255,255,255,0.5)" stroke="#222" strokeWidth={1} strokeDasharray="3 2" />
          <path d={`M${c.x},${c.y - r} L${c.x + r * 0.18},${c.y} L${c.x},${c.y + r * 0.55} L${c.x - r * 0.18},${c.y} Z`}
            fill="#222" />
          <text x={c.x} y={c.y - r - 4} textAnchor="middle" fontSize={11} fill="#222">N</text>
        </g>
      );
    }
    return null;
  };

  // 選択ハイライト
  const renderSelectionOverlay = () => {
    if (!selectedId) return null;
    const sel = renderShapes.find(s => s.id === selectedId);
    if (!sel) return null;
    const stroke = '#ff7a00';
    const sw = 2.5;
    switch (sel.type) {
      case 'site': {
        const d = sel.points.map((p, i) => {
          const sp = project(p);
          return `${i === 0 ? 'M' : 'L'}${sp.x},${sp.y}`;
        }).join(' ') + ' Z';
        return <path d={d} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray="6 3" />;
      }
      case 'building': {
        // 回転後の実際の 4 隅でハイライト（描画本体と一致）
        const corners = buildingCorners(sel).map(c => project(c));
        const d = corners.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';
        return <path d={d} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray="6 3" />;
      }
      case 'road': {
        const a = sel.centerLine[0], b = sel.centerLine[1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const half = sel.width / 2;
        const p1 = project({ x: a.x + nx * half, y: a.y + ny * half });
        const p2 = project({ x: b.x + nx * half, y: b.y + ny * half });
        const p3 = project({ x: b.x - nx * half, y: b.y - ny * half });
        const p4 = project({ x: a.x - nx * half, y: a.y - ny * half });
        return <path d={`M${p1.x},${p1.y} L${p2.x},${p2.y} L${p3.x},${p3.y} L${p4.x},${p4.y} Z`}
          fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray="6 3" />;
      }
      case 'compass': {
        const c = project(sel.center);
        return <circle cx={c.x} cy={c.y} r={sel.radius * pxPerMM + 3}
          fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray="6 3" />;
      }
      case 'dimension': {
        // 描画本体と同じ offset 後の本線 + 補助線をハイライト
        const g = computeDimensionGeometry(sel.start, sel.end, sel.offset);
        const pStart = project(g.start);
        const pEnd   = project(g.end);
        const pOS    = project(g.offStart);
        const pOE    = project(g.offEnd);
        return (
          <g>
            <line x1={pOS.x} y1={pOS.y} x2={pOE.x} y2={pOE.y}
              stroke={stroke} strokeWidth={sw} strokeDasharray="6 3" />
            <line x1={pStart.x} y1={pStart.y} x2={pOS.x} y2={pOS.y}
              stroke={stroke} strokeWidth={sw * 0.6} strokeDasharray="3 2" />
            <line x1={pEnd.x} y1={pEnd.y} x2={pOE.x} y2={pOE.y}
              stroke={stroke} strokeWidth={sw * 0.6} strokeDasharray="3 2" />
          </g>
        );
      }
    }
  };

  // 縮尺に応じてバー長を 1m / 5m / 10m / 50m / 100m に切替
  const scaleBarMM = (() => {
    const candidates = [1000, 5000, 10000, 50000, 100000, 500000];
    for (const c of candidates) if (c * pxPerMM >= 80 && c * pxPerMM <= 250) return c;
    return 5000;
  })();

  // 縮尺率の表示用：1mm = pxPerMM px → 1/N で N = (1/pxPerMM) / DPI_FACTOR(approx)
  // ここでは 1/M = 100 を「初期値」として、相対倍率 = pxPerMM / initialPxPerMM をかけた逆数
  const displayedScale = Math.round(drawing.scale * (initialView.pxPerMM / pxPerMM));

  return (
    <div ref={wrapRef} className="cad-canvas-wrap">
      <svg
        ref={svgRef}
        className="cad-canvas"
        width={size.w}
        height={size.h}
        style={{ cursor: effectiveCursor }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onClick={onClick}
        onContextMenu={onContextMenu}
      >
        <rect x={0} y={0} width={size.w} height={size.h} fill="#ffffff" />

        <g className="grid-fine">
          {gridLines.filter(l => !l.coarse).map((l, i) => (
            <line key={`f${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#eef0f4" strokeWidth={1} shapeRendering="crispEdges" />
          ))}
        </g>
        <g className="grid-coarse">
          {gridLines.filter(l => l.coarse).map((l, i) => (
            <line key={`c${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#d0d6e0" strokeWidth={1} shapeRendering="crispEdges" />
          ))}
        </g>

        {(() => {
          const o = project({ x: 0, y: 0 });
          if (o.x < -20 || o.x > size.w + 20 || o.y < -20 || o.y > size.h + 20) return null;
          return (
            <g className="origin">
              <line x1={o.x - 8} y1={o.y} x2={o.x + 8} y2={o.y} stroke="#b04040" strokeWidth={1} />
              <line x1={o.x} y1={o.y - 8} x2={o.x} y2={o.y + 8} stroke="#b04040" strokeWidth={1} />
            </g>
          );
        })()}

        <g className="shapes">
          {renderShapes.map(s => {
            switch (s.type) {
              case 'site': {
                const pts = s.points.map(p => project(p));
                if (pts.length === 0) return null;
                const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';
                return <path key={s.id} d={d}
                  fill="rgba(255, 230, 150, 0.25)" stroke="#a06000"
                  strokeWidth={2} strokeDasharray="6 3 1 3" />;
              }
              case 'road': {
                if (s.centerLine.length < 2) return null;
                const a = s.centerLine[0];
                const b = s.centerLine[1];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const len = Math.hypot(dx, dy) || 1;
                const nx = -dy / len, ny = dx / len;
                const half = s.width / 2;
                const p1 = project({ x: a.x + nx * half, y: a.y + ny * half });
                const p2 = project({ x: b.x + nx * half, y: b.y + ny * half });
                const p3 = project({ x: b.x - nx * half, y: b.y - ny * half });
                const p4 = project({ x: a.x - nx * half, y: a.y - ny * half });
                const cA = project(a);
                const cB = project(b);
                return (
                  <g key={s.id}>
                    <path d={`M${p1.x},${p1.y} L${p2.x},${p2.y} L${p3.x},${p3.y} L${p4.x},${p4.y} Z`}
                      fill="#e7e9ec" stroke="#888" strokeWidth={1} />
                    <line x1={cA.x} y1={cA.y} x2={cB.x} y2={cB.y}
                      stroke="#888" strokeWidth={1} strokeDasharray="6 4" />
                    <text x={(cA.x + cB.x) / 2} y={(cA.y + cB.y) / 2 - 6}
                      fontSize={11} fill="#666" textAnchor="middle">道路 (W={s.width}mm)</text>
                  </g>
                );
              }
              case 'building': {
                const o = project({ x: s.origin.x, y: s.origin.y + s.depth });
                const w = s.width * pxPerMM;
                const h = s.depth * pxPerMM;
                const cx = o.x + w / 2;
                const cy = o.y + h / 2;
                return (
                  <g key={s.id} transform={s.rotation ? `rotate(${-s.rotation} ${cx} ${cy})` : undefined}>
                    <rect x={o.x} y={o.y} width={w} height={h}
                      fill="rgba(120, 170, 220, 0.25)" stroke="#1f4e87" strokeWidth={2} />
                    <line x1={o.x} y1={o.y} x2={o.x + w} y2={o.y + h} stroke="#1f4e87" strokeWidth={0.8} />
                    <line x1={o.x + w} y1={o.y} x2={o.x} y2={o.y + h} stroke="#1f4e87" strokeWidth={0.8} />
                    {s.name && (
                      <text x={cx} y={cy} fontSize={12} fill="#1f4e87" textAnchor="middle"
                        dominantBaseline="middle">{s.name}</text>
                    )}
                  </g>
                );
              }
              case 'dimension': {
                const g = computeDimensionGeometry(s.start, s.end, s.offset);
                const pStart = project(g.start);
                const pEnd   = project(g.end);
                const pOS    = project(g.offStart);
                const pOE    = project(g.offEnd);
                const pMid   = project(g.mid);
                const text   = s.text ?? formatDimensionText(s.start, s.end);
                return (
                  <g key={s.id} className="dimension">
                    <line x1={pStart.x} y1={pStart.y} x2={pOS.x} y2={pOS.y} stroke="#444" strokeWidth={0.8} />
                    <line x1={pEnd.x}   y1={pEnd.y}   x2={pOE.x} y2={pOE.y} stroke="#444" strokeWidth={0.8} />
                    <line x1={pOS.x} y1={pOS.y} x2={pOE.x} y2={pOE.y} stroke="#444" strokeWidth={0.8} />
                    <circle cx={pOS.x} cy={pOS.y} r={2} fill="#444" />
                    <circle cx={pOE.x} cy={pOE.y} r={2} fill="#444" />
                    <text x={pMid.x} y={pMid.y - 4}
                      fontSize={11} fill="#222" textAnchor="middle"
                      transform={`rotate(${-g.angleDeg} ${pMid.x} ${pMid.y})`}
                    >{text}</text>
                  </g>
                );
              }
              case 'compass': {
                const c = project(s.center);
                const r = s.radius * pxPerMM;
                return (
                  <g key={s.id} className="compass">
                    <circle cx={c.x} cy={c.y} r={r} fill="white" stroke="#222" strokeWidth={1} />
                    <path d={`M${c.x},${c.y - r} L${c.x + r * 0.18},${c.y} L${c.x},${c.y + r * 0.55} L${c.x - r * 0.18},${c.y} Z`}
                      fill="#222" />
                    <text x={c.x} y={c.y - r - 4} textAnchor="middle" fontSize={11} fill="#222">N</text>
                  </g>
                );
              }
              default: return null;
            }
          })}
        </g>

        {/* 自動寸法線（表示専用、ドラッグ非対応） */}
        {showAutoDimensions && (
          <g className="auto-dimensions" opacity={0.85}>
            {generateAutoDimensions(drawing).map(s => {
              const g = computeDimensionGeometry(s.start, s.end, s.offset);
              const pStart = project(g.start);
              const pEnd   = project(g.end);
              const pOS    = project(g.offStart);
              const pOE    = project(g.offEnd);
              const pMid   = project(g.mid);
              const text   = s.text ?? formatDimensionText(s.start, s.end);
              return (
                <g key={s.id}>
                  <line x1={pStart.x} y1={pStart.y} x2={pOS.x} y2={pOS.y} stroke="#a01e1e" strokeWidth={0.6} strokeDasharray="2 2" />
                  <line x1={pEnd.x}   y1={pEnd.y}   x2={pOE.x} y2={pOE.y} stroke="#a01e1e" strokeWidth={0.6} strokeDasharray="2 2" />
                  <line x1={pOS.x} y1={pOS.y} x2={pOE.x} y2={pOE.y} stroke="#a01e1e" strokeWidth={0.6} />
                  <circle cx={pOS.x} cy={pOS.y} r={1.5} fill="#a01e1e" />
                  <circle cx={pOE.x} cy={pOE.y} r={1.5} fill="#a01e1e" />
                  <text x={pMid.x} y={pMid.y - 3}
                    fontSize={10} fill="#a01e1e" textAnchor="middle"
                    transform={`rotate(${-g.angleDeg} ${pMid.x} ${pMid.y})`}
                  >{text}</text>
                </g>
              );
            })}
          </g>
        )}

        <g className="selection">{renderSelectionOverlay()}</g>
        <g className="preview">{renderInputPreview()}</g>

        {cursor && tool !== 'select' && tool !== 'delete' && pan.kind === 'none' && (() => {
          const sp = project(cursor);
          return (
            <g className="snap-cursor">
              <circle cx={sp.x} cy={sp.y} r={5} fill="none" stroke="#3879c5" strokeWidth={1.2} />
              <line x1={sp.x - 8} y1={sp.y} x2={sp.x + 8} y2={sp.y} stroke="#3879c5" strokeWidth={1} />
              <line x1={sp.x} y1={sp.y - 8} x2={sp.x} y2={sp.y + 8} stroke="#3879c5" strokeWidth={1} />
            </g>
          );
        })()}

        {/* 縮尺バー */}
        {(() => {
          const a = { x: 14, y: size.h - 22 };
          const b = { x: a.x + scaleBarMM * pxPerMM, y: a.y };
          const labelM = scaleBarMM >= 1000 ? `${scaleBarMM / 1000} m` : `${scaleBarMM} mm`;
          return (
            <g className="scalebar">
              <line x1={a.x} y1={a.y} x2={b.x} y2={a.y} stroke="#222" strokeWidth={2} />
              <line x1={a.x} y1={a.y - 4} x2={a.x} y2={a.y + 4} stroke="#222" strokeWidth={2} />
              <line x1={b.x} y1={a.y - 4} x2={b.x} y2={a.y + 4} stroke="#222" strokeWidth={2} />
              <text x={(a.x + b.x) / 2} y={a.y - 6} textAnchor="middle" fontSize={11} fill="#222">{labelM}</text>
              <text x={a.x} y={a.y + 14} fontSize={11} fill="#222">縮尺 1/{displayedScale}</text>
            </g>
          );
        })()}
      </svg>

      {/* ビュー操作オーバーレイ（右上） */}
      <div className="view-overlay">
        <button type="button" title="ズームイン (ホイール)" onClick={() => setPxPerMM(p => Math.min(PX_PER_MM_MAX, p * ZOOM_FACTOR))}>+</button>
        <button type="button" title="ズームアウト (ホイール)" onClick={() => setPxPerMM(p => Math.max(PX_PER_MM_MIN, p / ZOOM_FACTOR))}>−</button>
        <button type="button" title="全体表示 (F)" onClick={() => fitToShapes(drawing.shapes)}>全体</button>
      </div>
    </div>
  );
});
