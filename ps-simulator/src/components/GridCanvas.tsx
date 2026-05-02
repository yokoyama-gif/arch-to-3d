import { useRef, useState, useCallback, useEffect } from "react";
import type {
  Fixture,
  FixtureType,
  PipeRoute,
  PipeDiameters,
  PipeType,
  BackgroundImage,
} from "../domain/types";
import { structuralFixtureTypes } from "../domain/types";
import {
  fixtureLabels,
  fixtureColors,
  fixtureDrainSpec,
} from "../domain/rules/fixtureDefaults";
import { pipeColors, pipeTypeLabels } from "../domain/rules/pipeSpecs";
import { CANVAS_DEFAULTS } from "../domain/rules/canvasDefaults";
import { snapToGrid } from "../utils/geometry";

// キャンバス＝A3横@1/100の実寸範囲 (42000×29700mm)
const DEFAULT_CANVAS_W = CANVAS_DEFAULTS.widthMm;
const DEFAULT_CANVAS_H = CANVAS_DEFAULTS.heightMm;
const MIN_SCALE = 0.005;
const MAX_SCALE = 0.5;
const DEFAULT_SCALE = CANVAS_DEFAULTS.defaultScale;
const ZOOM_STEP = 0.005;

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
  /** 管種ごとの横管・竪管φ(mm)。線幅と竪管マーカー径に反映 */
  pipeDiameters: PipeDiameters;
  /** 背景平面図（読み込み済みの場合グリッド背面に描画） */
  backgroundImage?: BackgroundImage | null;
  placingType: FixtureType | null;
  onAddFixture: (type: FixtureType, x: number, y: number) => void;
  onMoveFixture: (id: string, x: number, y: number) => void;
  onSelectFixture: (id: string | null) => void;
  onDeleteFixture?: (id: string) => void;
  onRotateFixture?: (id: string) => void;
  /** リサイズ確定: 位置と寸法を一括更新 */
  onResizeFixtureGeometry?: (id: string, x: number, y: number, w: number, h: number) => void;
  /** 排水溝の位置を更新（設備左上からのmm） */
  onSetDrainOffset?: (id: string, offsetX: number, offsetY: number) => void;
  /** 配管中間点(エルボ)位置の上書き */
  onSetPipeMidPoint?: (id: string, pipeType: PipeType, x: number, y: number) => void;
  /** 背景画像移動 (mm単位の絶対位置) */
  onMoveBackground?: (x: number, y: number) => void;
  /** 背景画像のスケール調整: 現状のwidthMm/heightMmにfactorを掛ける */
  onScaleBackground?: (factor: number) => void;
  /** 校正モード（2点指定）の状態と切替 */
  calibrationMode?: boolean;
  /** 校正の2点指定が完了したときに呼ばれる(現実距離を尋ねる) */
  onCalibrationDone?: (
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ) => void;
  /**
   * 背景ドラッグモード。ON時は空白クリックが背景画像の移動に使われる。
   * OFF時はパレット配置・選択解除など通常動作。
   */
  bgDragMode?: boolean;
  /**
   * 背景画像のスナップ単位(mm)。未指定なら gridSizeMm を使う。
   * モジュール(900等)を渡すと、ドラッグ中も粗いグリッドで動く。
   */
  bgSnapStepMm?: number;
  /** 柱マーク追加モード(ON時、背景上のクリックでマーク追加) */
  markingMode?: boolean;
  /** マーク追加コールバック(背景左上からのmmオフセット) */
  onAddMarker?: (offsetX: number, offsetY: number) => void;
};

export function GridCanvas({
  fixtures,
  pipeRoutes,
  selectedFixtureId,
  gridSizeMm,
  gridDivision,
  pipeDiameters,
  backgroundImage,
  placingType,
  onAddFixture,
  onMoveFixture,
  onSelectFixture,
  onDeleteFixture,
  onRotateFixture,
  onResizeFixtureGeometry,
  onSetDrainOffset,
  onSetPipeMidPoint,
  onMoveBackground,
  onScaleBackground: _onScaleBackground,
  calibrationMode,
  onCalibrationDone,
  bgDragMode,
  bgSnapStepMm,
  markingMode,
  onAddMarker,
}: Props) {
  // _onScaleBackground は API 互換のため受け取り、実際の計算は親で onCalibrationDone 経由
  void _onScaleBackground;
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(DEFAULT_SCALE);
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
  // 排水溝のドラッグ中状態（設備IDのみ保持。位置はマウスから直接計算）
  const [drainDragging, setDrainDragging] = useState<string | null>(null);
  // エルボ(配管中間点)ドラッグ中状態
  const [elbowDragging, setElbowDragging] = useState<{
    fixtureId: string;
    pipeType: PipeType;
  } | null>(null);
  // 背景画像のドラッグ中（開始位置と背景元位置を保持）
  const [bgDragging, setBgDragging] = useState<{
    startMouseX: number;
    startMouseY: number;
    startX: number;
    startY: number;
  } | null>(null);
  // 校正用の最初のクリック点（2点目で確定）
  const [calibPoint1, setCalibPoint1] = useState<{ x: number; y: number } | null>(null);
  // 左+右同時ドラッグでのズーム用：直前のクライアントY座標を保持(レガシー、未使用)
  const [dualBtnZoomY, setDualBtnZoomY] = useState<number | null>(null);
  // ラバーバンドズーム: 左+右ドラッグで範囲を選択し、その範囲に拡大表示する
  const [zoomBox, setZoomBox] = useState<{
    startMm: { x: number; y: number };
    currentMm: { x: number; y: number };
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
        } else if (
          e.key === "ArrowUp" ||
          e.key === "ArrowDown" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight"
        ) {
          // 排水溝のある設備が選択中なら、十字キーで排水溝を動かす
          const f = fixtures.find((ff) => ff.id === selectedFixtureId);
          if (!f) return;
          const drain = fixtureDrainSpec[f.type];
          if (!drain || !onSetDrainOffset) return;
          e.preventDefault();
          const step = gridSizeMm; // 1グリッド単位で移動
          const curX = f.drainOffsetMm ? f.drainOffsetMm.x : f.w * drain.ratioX;
          const curY = f.drainOffsetMm ? f.drainOffsetMm.y : f.h * drain.ratioY;
          let nx = curX;
          let ny = curY;
          if (e.key === "ArrowUp") ny -= step;
          if (e.key === "ArrowDown") ny += step;
          if (e.key === "ArrowLeft") nx -= step;
          if (e.key === "ArrowRight") nx += step;
          onSetDrainOffset(selectedFixtureId, nx, ny);
        }
      } else if (
        bgDragMode &&
        backgroundImage &&
        onMoveBackground &&
        (e.key === "ArrowUp" ||
          e.key === "ArrowDown" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight")
      ) {
        // 図面移動モードON+設備未選択なら、十字キーで背景画像を移動
        // モジュールスナップが有効ならbgSnapStepMmを使う（粗合わせ）
        e.preventDefault();
        const step = bgSnapStepMm ?? gridSizeMm;
        let nx = backgroundImage.x;
        let ny = backgroundImage.y;
        if (e.key === "ArrowUp") ny -= step;
        if (e.key === "ArrowDown") ny += step;
        if (e.key === "ArrowLeft") nx -= step;
        if (e.key === "ArrowRight") nx += step;
        onMoveBackground(nx, ny);
      } else if (e.key === "Escape" && placingType) {
        // 配置モードをキャンセル（親でハンドル）
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedFixtureId,
    placingType,
    fixtures,
    gridSizeMm,
    bgDragMode,
    bgSnapStepMm,
    backgroundImage,
    onDeleteFixture,
    onRotateFixture,
    onSelectFixture,
    onSetDrainOffset,
    onMoveBackground,
  ]);

  // --- ズーム（マウスホイールで直接） ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // 縮小方向にずらした倍率: ホイール量に比例してズーム量を調整
      const delta = e.deltaY > 0 ? -ZOOM_STEP * 2 : ZOOM_STEP * 2;
      setScale((prev) =>
        Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta))
      );
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (dragging || bgDragging) return;
      // 柱マーク追加モード: クリック位置に背景左上からのオフセットでマーク追加
      if (markingMode && backgroundImage && onAddMarker) {
        const pos = getMouseMm(e);
        const offsetX = pos.x - backgroundImage.x;
        const offsetY = pos.y - backgroundImage.y;
        onAddMarker(offsetX, offsetY);
        return;
      }
      // 校正モード: 2点指定で完了
      if (calibrationMode) {
        const pos = getMouseMm(e);
        if (!calibPoint1) {
          setCalibPoint1({ x: pos.x, y: pos.y });
        } else {
          onCalibrationDone?.(calibPoint1, { x: pos.x, y: pos.y });
          setCalibPoint1(null);
        }
        return;
      }
      if (placingType) {
        // 既存の設備(data-fixture)をクリックした場合は配置しない（誤配置防止）
        const target = e.target as Element;
        const onFixture = target.getAttribute("data-fixture") ||
          target.closest("[data-fixture]");
        if (onFixture) return;
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
    [
      placingType,
      dragging,
      bgDragging,
      calibrationMode,
      calibPoint1,
      markingMode,
      backgroundImage,
      onAddMarker,
      getMouseMm,
      onAddFixture,
      onSelectFixture,
      onCalibrationDone,
    ]
  );

  /** 背景画像 mousedown：ドラッグ開始 */
  const handleBackgroundMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!backgroundImage || !onMoveBackground) return;
      // 背景ドラッグは「図面移動モード」がONのときのみ反応する。
      // OFFのときはパレット配置や設備選択の邪魔にならないよう完全に無視。
      if (!bgDragMode) return;
      if (placingType || calibrationMode) return;
      e.stopPropagation();
      const pos = getMouseMm(e);
      setBgDragging({
        startMouseX: pos.x,
        startMouseY: pos.y,
        startX: backgroundImage.x,
        startY: backgroundImage.y,
      });
    },
    [backgroundImage, onMoveBackground, placingType, calibrationMode, bgDragMode, getMouseMm]
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

  /** 排水溝mousedown */
  const handleDrainMouseDown = useCallback(
    (e: React.MouseEvent, fixtureId: string) => {
      e.stopPropagation();
      setDrainDragging(fixtureId);
    },
    []
  );

  /** エルボ(配管中間点)mousedown */
  const handleElbowMouseDown = useCallback(
    (e: React.MouseEvent, fixtureId: string, pipeType: PipeType) => {
      e.stopPropagation();
      setElbowDragging({ fixtureId, pipeType });
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // 背景ドラッグ
      if (bgDragging && onMoveBackground) {
        const pos = getMouseMm(e);
        const dx = pos.x - bgDragging.startMouseX;
        const dy = pos.y - bgDragging.startMouseY;
        // モジュールスナップが有効ならbgSnapStepMmを使う
        const step = bgSnapStepMm ?? gridSizeMm;
        const newX = snapToGrid(bgDragging.startX + dx, step);
        const newY = snapToGrid(bgDragging.startY + dy, step);
        onMoveBackground(newX, newY);
        return;
      }
      // エルボドラッグ
      if (elbowDragging && onSetPipeMidPoint) {
        const pos = getMouseMm(e);
        const snappedX = snapToGrid(pos.x, gridSizeMm);
        const snappedY = snapToGrid(pos.y, gridSizeMm);
        onSetPipeMidPoint(
          elbowDragging.fixtureId,
          elbowDragging.pipeType,
          snappedX,
          snappedY
        );
        return;
      }
      // 排水溝ドラッグ
      if (drainDragging && onSetDrainOffset) {
        const fixture = fixtures.find((f) => f.id === drainDragging);
        if (fixture) {
          const pos = getMouseMm(e);
          // 設備左上からの相対オフセット
          const offsetX = pos.x - fixture.x;
          const offsetY = pos.y - fixture.y;
          onSetDrainOffset(drainDragging, offsetX, offsetY);
        }
        return;
      }
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
    [
      dragging,
      resizing,
      drainDragging,
      elbowDragging,
      bgDragging,
      bgSnapStepMm,
      fixtures,
      getMouseMm,
      gridSizeMm,
      onMoveFixture,
      onResizeFixtureGeometry,
      onSetDrainOffset,
      onSetPipeMidPoint,
      onMoveBackground,
    ]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setResizing(null);
    setDrainDragging(null);
    setElbowDragging(null);
    setBgDragging(null);
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
        <span style={{ minWidth: 70, textAlign: "center" }}>
          {(scale * 100).toFixed(1)}%
        </span>
        <button
          onClick={() => setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP * 2))}
          style={{ padding: "2px 8px", cursor: "pointer", fontSize: 14 }}
          title="ズームイン"
        >
          +
        </button>
        <button
          onClick={() => setScale(DEFAULT_SCALE)}
          style={{ padding: "2px 8px", cursor: "pointer", fontSize: 11 }}
          title="標準ズーム(全体表示)"
        >
          標準
        </button>
        <button
          onClick={() => setScale(0.14)}
          style={{ padding: "2px 8px", cursor: "pointer", fontSize: 11 }}
          title="設備配置時に使いやすいズーム"
        >
          詳細
        </button>
        <span style={{ color: "#999", fontSize: 11, marginLeft: 8 }}>
          範囲 {DEFAULT_CANVAS_W / 1000}×{DEFAULT_CANVAS_H / 1000}m / ホイールでズーム / 左+右ドラッグで範囲ズーム / 図面はドラッグ・十字キーで移動
        </span>
      </div>

      <svg
        ref={svgRef}
        width={svgWidth}
        height={svgHeight}
        style={{
          background: "#fff",
          border: "1px solid #ccc",
          cursor: zoomBox
            ? "zoom-in"
            : calibrationMode || placingType || markingMode
              ? "crosshair"
              : "default",
        }}
        onClick={(e) => {
          // ラバーバンドズーム中・直後の click は無視
          if (zoomBox || dualBtnZoomY != null) return;
          handleCanvasClick(e);
        }}
        onMouseMove={(e) => {
          // 左+右同時押し中ならラバーバンドで範囲選択
          if ((e.buttons & 3) === 3) {
            const pos = getMouseMm(e);
            if (!zoomBox) {
              // ドラッグ中の他のすべての操作をキャンセル(ズーム選択へ即切替)
              setDragging(null);
              setBgDragging(null);
              setResizing(null);
              setDrainDragging(null);
              setElbowDragging(null);
              setZoomBox({ startMm: pos, currentMm: pos });
            } else {
              setZoomBox({ ...zoomBox, currentMm: pos });
            }
            return;
          }
          // 同時押しが解除された → 何もしない（mouseupで処理）
          handleMouseMove(e);
        }}
        onMouseDown={(e) => {
          if ((e.buttons & 3) === 3) {
            e.preventDefault();
            const pos = getMouseMm(e);
            setDragging(null);
            setBgDragging(null);
            setResizing(null);
            setDrainDragging(null);
            setElbowDragging(null);
            setZoomBox({ startMm: pos, currentMm: pos });
          }
        }}
        onMouseUp={(e) => {
          // どちらかのボタンが離されたタイミングでズームを確定
          if (zoomBox && (e.buttons & 3) !== 3) {
            const x1 = Math.min(zoomBox.startMm.x, zoomBox.currentMm.x);
            const y1 = Math.min(zoomBox.startMm.y, zoomBox.currentMm.y);
            const x2 = Math.max(zoomBox.startMm.x, zoomBox.currentMm.x);
            const y2 = Math.max(zoomBox.startMm.y, zoomBox.currentMm.y);
            const boxW = x2 - x1;
            const boxH = y2 - y1;
            // 極小選択は無視(クリック扱い)
            if (boxW < 100 || boxH < 100) {
              setZoomBox(null);
              return;
            }
            // 親スクロールコンテナのサイズを取得して目標スケールを計算
            const scrollEl = containerRef.current?.parentElement;
            if (scrollEl) {
              const viewW = scrollEl.clientWidth;
              const viewH = scrollEl.clientHeight;
              // 90%余白で枠が画面に余裕で収まるサイズに
              const targetScale = Math.min(
                MAX_SCALE,
                Math.max(
                  MIN_SCALE,
                  Math.min(viewW / boxW, viewH / boxH) * 0.9
                )
              );
              setScale(targetScale);
              // スケール反映後にスクロール位置を中央へ
              const cxMm = (x1 + x2) / 2;
              const cyMm = (y1 + y2) / 2;
              requestAnimationFrame(() => {
                scrollEl.scrollLeft = cxMm * targetScale - viewW / 2;
                scrollEl.scrollTop = cyMm * targetScale - viewH / 2;
              });
            }
            setZoomBox(null);
          }
          handleMouseUp();
        }}
        onMouseLeave={() => {
          setZoomBox(null);
          setDualBtnZoomY(null);
          handleMouseUp();
        }}
        onContextMenu={(e) => {
          // 右ドラッグズーム時にコンテキストメニューが出ると邪魔なので抑制
          e.preventDefault();
        }}
      >
        {/* 背景平面図(グリッドの後ろに表示) */}
        {backgroundImage && (
          <image
            href={backgroundImage.dataUrl}
            x={mmToPx(backgroundImage.x)}
            y={mmToPx(backgroundImage.y)}
            width={mmToPx(backgroundImage.widthMm)}
            height={mmToPx(backgroundImage.heightMm)}
            opacity={backgroundImage.opacity}
            preserveAspectRatio="none"
            /*
             * 背景画像のクリック反応は「図面移動モード」のときだけ。
             *  - 校正モード中  : 透過(クリックは校正用に使う)
             *  - bgDragMode ON: 反応(ドラッグで移動)
             *  - 通常モード   : 透過(設備配置・選択の邪魔をしない)
             */
            pointerEvents={
              calibrationMode ? "none" : bgDragMode ? "auto" : "none"
            }
            style={{
              cursor: calibrationMode
                ? "crosshair"
                : bgDragMode
                ? "move"
                : "default",
              // 白黒モード（grayscaleフィルタ + コントラスト軽くアップ）
              filter: backgroundImage.grayscale
                ? "grayscale(1) contrast(1.1)"
                : undefined,
            }}
            onMouseDown={handleBackgroundMouseDown}
          />
        )}

        {/* 柱マーク（背景に追従、赤いクロスヘア） */}
        {backgroundImage?.markers?.map((m, i) => {
          const ax = backgroundImage.x + m.x;
          const ay = backgroundImage.y + m.y;
          const cx = mmToPx(ax);
          const cy = mmToPx(ay);
          // グリッド交点との差を判定して色を変える
          const gxNearest = Math.round(ax / gridSizeMm) * gridSizeMm;
          const gyNearest = Math.round(ay / gridSizeMm) * gridSizeMm;
          const offGrid =
            Math.abs(ax - gxNearest) > 0.5 || Math.abs(ay - gyNearest) > 0.5;
          const color = offGrid ? "#e53935" : "#43a047";
          return (
            <g key={`marker-${i}`} pointerEvents="none">
              <line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke={color} strokeWidth={1.5} />
              <line x1={cx} y1={cy - 8} x2={cx} y2={cy + 8} stroke={color} strokeWidth={1.5} />
              <circle cx={cx} cy={cy} r={3} fill={color} />
              <text
                x={cx + 10}
                y={cy - 4}
                fontSize={9}
                fill={color}
                fontWeight={700}
                style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 }}
              >
                {i + 1}{offGrid ? "" : " ✓"}
              </text>
            </g>
          );
        })}

        {/* 背景画像の四隅に座標ラベル（移動モード中のみ表示）*/}
        {backgroundImage && bgDragMode && (() => {
          const bg = backgroundImage;
          const corners: Array<{ x: number; y: number; label: string; ax: "start" | "middle" | "end"; ay: number }> = [
            { x: bg.x, y: bg.y, label: `(${bg.x}, ${bg.y})`, ax: "start", ay: -4 },
            { x: bg.x + bg.widthMm, y: bg.y, label: `(${bg.x + bg.widthMm}, ${bg.y})`, ax: "end", ay: -4 },
            { x: bg.x, y: bg.y + bg.heightMm, label: `(${bg.x}, ${bg.y + bg.heightMm})`, ax: "start", ay: 12 },
            { x: bg.x + bg.widthMm, y: bg.y + bg.heightMm, label: `(${bg.x + bg.widthMm}, ${bg.y + bg.heightMm})`, ax: "end", ay: 12 },
          ];
          return (
            <g pointerEvents="none">
              {corners.map((c, i) => (
                <g key={i}>
                  <circle cx={mmToPx(c.x)} cy={mmToPx(c.y)} r={4} fill="#1976d2" />
                  <text
                    x={mmToPx(c.x) + (c.ax === "start" ? 6 : -6)}
                    y={mmToPx(c.y) + c.ay}
                    fontSize={10}
                    fill="#1976d2"
                    fontWeight={700}
                    textAnchor={c.ax}
                    style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 }}
                  >
                    {c.label}
                  </text>
                </g>
              ))}
            </g>
          );
        })()}

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

        {/* 設備→PS 距離ラベル（設備の上に表示） */}
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
            </g>
            {/* 排水溝（水回り設備のみ。ドラッグで位置変更可能） */}
              {(() => {
                const drain = fixtureDrainSpec[f.type];
                if (!drain) return null;
                // 個別オフセットがあればそれを使用、なければデフォルト比率
                const localX = f.drainOffsetMm
                  ? f.drainOffsetMm.x
                  : f.w * drain.ratioX;
                const localY = f.drainOffsetMm
                  ? f.drainOffsetMm.y
                  : f.h * drain.ratioY;
                const cxMm = f.x + localX;
                const cyMm = f.y + localY;
                const rPx = mmToPx(drain.diameterMm / 2);
                const isDragging = drainDragging === f.id;
                return (
                  <g>
                    {/* 当たり判定を広げるための透明な大きい円 */}
                    <circle
                      cx={mmToPx(cxMm)}
                      cy={mmToPx(cyMm)}
                      r={Math.max(rPx, 8)}
                      fill="transparent"
                      style={{ cursor: "move" }}
                      onMouseDown={(e) => handleDrainMouseDown(e, f.id)}
                    />
                    <circle
                      cx={mmToPx(cxMm)}
                      cy={mmToPx(cyMm)}
                      r={rPx}
                      fill="rgba(255,255,255,0.6)"
                      stroke={isDragging ? "#0d47a1" : "#1e88e5"}
                      strokeWidth={isDragging ? 1.8 : 1.2}
                      pointerEvents="none"
                    />
                    {/* 排水口を示すクロスマーク */}
                    <line
                      x1={mmToPx(cxMm) - rPx * 0.6}
                      y1={mmToPx(cyMm)}
                      x2={mmToPx(cxMm) + rPx * 0.6}
                      y2={mmToPx(cyMm)}
                      stroke="#1e88e5"
                      strokeWidth={0.8}
                      pointerEvents="none"
                    />
                    <line
                      x1={mmToPx(cxMm)}
                      y1={mmToPx(cyMm) - rPx * 0.6}
                      x2={mmToPx(cxMm)}
                      y2={mmToPx(cyMm) + rPx * 0.6}
                      stroke="#1e88e5"
                      strokeWidth={0.8}
                      pointerEvents="none"
                    />
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* 配管ルート(設備の上に灰色の横管として描画) */}
        {pipeRoutes.map((route, i) => {
          const sameFixtureRoutes = pipeRoutes.filter(
            (r) => r.fixtureId === route.fixtureId
          );
          const indexInGroup = sameFixtureRoutes.indexOf(route);
          const offset = (indexInGroup - (sameFixtureRoutes.length - 1) / 2) * 3;

          const isDrainPipe =
            route.pipeType === "soil" ||
            route.pipeType === "waste" ||
            route.pipeType === "vent";
          const elbowPoint = route.points[1];
          const riserPoint = route.points[route.points.length - 1];
          const pipeColor = pipeColors[route.pipeType] ?? "#999";

          // 径
          const diameters = pipeDiameters?.[route.pipeType];
          const horizDiamMm = diameters?.horizontalMm ?? 50;
          const riserDiamMm = diameters?.riserMm ?? 50;
          const horizStrokePx = Math.max(1, mmToPx(horizDiamMm));
          const riserRadiusPx = Math.max(3, mmToPx(riserDiamMm) / 2);

          // 横管終点を竪管エッジで止める（最終セグメントの方向に沿って短縮）
          const adjustedPoints = (() => {
            if (route.points.length < 2) return route.points;
            const last = route.points[route.points.length - 1];
            const prev = route.points[route.points.length - 2];
            const dx = last.x - prev.x;
            const dy = last.y - prev.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) return route.points;
            const riserRadiusMm = riserDiamMm / 2;
            const newLast = {
              x: last.x - (dx / len) * riserRadiusMm,
              y: last.y - (dy / len) * riserRadiusMm,
            };
            return [...route.points.slice(0, -1), newLast];
          })();

          const pts = adjustedPoints
            .map((p) => `${mmToPx(p.x) + offset},${mmToPx(p.y) + offset}`)
            .join(" ");

          const midIdx = Math.floor(route.points.length / 2);
          const p0 = route.points[midIdx - 1] ?? route.points[0];
          const p1 = route.points[midIdx] ?? route.points[0];
          const labelX = mmToPx((p0.x + p1.x) / 2) + offset;
          const labelY = mmToPx((p0.y + p1.y) / 2) + offset - 4;

          // 横管色: 排水系(soil/waste/vent)は灰色、給水系(cold/hot/gas)は管種色
          //  - 給水(cold)→青 #1565c0
          //  - 給湯(hot)→赤 #c62828
          //  - ガス(gas)→黄 #f9a825
          const horizColor = isDrainPipe ? "#777" : pipeColor;

          return (
            <g key={`route-${i}`}>
              <polyline
                points={pts}
                fill="none"
                stroke={horizColor}
                strokeWidth={horizStrokePx}
                strokeLinecap="butt"
                strokeLinejoin="miter"
                strokeDasharray={route.pipeType === "vent" ? "4 2" : undefined}
                opacity={0.85}
              />
              {/* 管種ラベル */}
              <rect
                x={labelX - 14}
                y={labelY - 8}
                width={28}
                height={12}
                rx={2}
                fill="rgba(255,255,255,0.95)"
                stroke="#ddd"
                strokeWidth={0.5}
                pointerEvents="none"
              />
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={8}
                fill={pipeColor}
                pointerEvents="none"
                fontWeight={700}
              >
                {pipeTypeLabels[route.pipeType]}
              </text>
              {isDrainPipe && (
                <>
                  {/* エルボ：横管の曲がり位置(灰色塗り) */}
                  <circle
                    cx={mmToPx(elbowPoint.x) + offset}
                    cy={mmToPx(elbowPoint.y) + offset}
                    r={Math.max(2, horizStrokePx * 0.5)}
                    fill={horizColor}
                    opacity={0.85}
                    pointerEvents="none"
                  />
                  {/* PS内の竪管 */}
                  <circle
                    cx={mmToPx(riserPoint.x) + offset}
                    cy={mmToPx(riserPoint.y) + offset}
                    r={riserRadiusPx}
                    fill="#fff"
                    stroke={pipeColor}
                    strokeWidth={1.8}
                    pointerEvents="none"
                  />
                  <circle
                    cx={mmToPx(riserPoint.x) + offset}
                    cy={mmToPx(riserPoint.y) + offset}
                    r={Math.max(1, riserRadiusPx * 0.25)}
                    fill={pipeColor}
                    pointerEvents="none"
                  />
                  <text
                    x={mmToPx(riserPoint.x) + offset + riserRadiusPx + 3}
                    y={mmToPx(riserPoint.y) + offset + 3}
                    fontSize={9}
                    fill={pipeColor}
                    fontWeight={600}
                    pointerEvents="none"
                  >
                    φ{riserDiamMm}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* 校正モード: 第1点マーカー */}
        {calibrationMode && calibPoint1 && (
          <g pointerEvents="none">
            <circle
              cx={mmToPx(calibPoint1.x)}
              cy={mmToPx(calibPoint1.y)}
              r={6}
              fill="rgba(255,193,7,0.7)"
              stroke="#f57f17"
              strokeWidth={2}
            />
            <text
              x={mmToPx(calibPoint1.x) + 10}
              y={mmToPx(calibPoint1.y) - 8}
              fontSize={11}
              fill="#f57f17"
              fontWeight={700}
            >
              1
            </text>
          </g>
        )}

        {/* 選択中設備のリサイズハンドル & 配管エルボハンドル(最前面) */}
        {(() => {
          const sel = fixtures.find((f) => f.id === selectedFixtureId);
          if (!sel || structuralFixtureTypes.has(sel.type)) return null;
          const handleSizePx = 8;
          const handleHalf = handleSizePx / 2;
          const xPx = mmToPx(sel.x);
          const yPx = mmToPx(sel.y);
          const wPx = mmToPx(sel.w);
          const hPx = mmToPx(sel.h);
          const handles: { key: ResizeHandle; cx: number; cy: number; cursor: string }[] = [
            { key: "nw", cx: xPx, cy: yPx, cursor: "nwse-resize" },
            { key: "n", cx: xPx + wPx / 2, cy: yPx, cursor: "ns-resize" },
            { key: "ne", cx: xPx + wPx, cy: yPx, cursor: "nesw-resize" },
            { key: "e", cx: xPx + wPx, cy: yPx + hPx / 2, cursor: "ew-resize" },
            { key: "se", cx: xPx + wPx, cy: yPx + hPx, cursor: "nwse-resize" },
            { key: "s", cx: xPx + wPx / 2, cy: yPx + hPx, cursor: "ns-resize" },
            { key: "sw", cx: xPx, cy: yPx + hPx, cursor: "nesw-resize" },
            { key: "w", cx: xPx, cy: yPx + hPx / 2, cursor: "ew-resize" },
          ];
          // 選択中設備に紐づく配管のエルボ点ハンドル
          const elbowHandles = pipeRoutes
            .filter((r) => r.fixtureId === sel.id && r.points.length >= 3)
            .map((r) => ({
              pipeType: r.pipeType,
              point: r.points[1],
            }));

          return (
            <g>
              {handles.map((h) => (
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
                  onMouseDown={(e) => handleResizeMouseDown(e, sel, h.key)}
                />
              ))}
              {/* 各配管のエルボ点ハンドル(緑色)。横管の曲がりをドラッグで自由変更 */}
              {elbowHandles.map((eh) => (
                <g key={`elbow-${eh.pipeType}`}>
                  <circle
                    cx={mmToPx(eh.point.x)}
                    cy={mmToPx(eh.point.y)}
                    r={6}
                    fill="#fff"
                    stroke="#2e7d32"
                    strokeWidth={2}
                    style={{ cursor: "move" }}
                    onMouseDown={(e) =>
                      handleElbowMouseDown(e, sel.id, eh.pipeType)
                    }
                  />
                  <circle
                    cx={mmToPx(eh.point.x)}
                    cy={mmToPx(eh.point.y)}
                    r={2}
                    fill="#2e7d32"
                    pointerEvents="none"
                  />
                </g>
              ))}
            </g>
          );
        })()}

        {/* ラバーバンドズームの選択枠（最前面） */}
        {zoomBox && (
          <rect
            x={mmToPx(Math.min(zoomBox.startMm.x, zoomBox.currentMm.x))}
            y={mmToPx(Math.min(zoomBox.startMm.y, zoomBox.currentMm.y))}
            width={mmToPx(
              Math.abs(zoomBox.currentMm.x - zoomBox.startMm.x)
            )}
            height={mmToPx(
              Math.abs(zoomBox.currentMm.y - zoomBox.startMm.y)
            )}
            fill="rgba(33,150,243,0.15)"
            stroke="#1976d2"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            pointerEvents="none"
          />
        )}
      </svg>
    </div>
  );
}
