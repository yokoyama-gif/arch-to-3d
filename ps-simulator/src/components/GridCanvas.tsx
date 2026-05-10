import { useRef, useState, useCallback, useEffect } from "react";
import type { ReactElement } from "react";
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
import { snapToGrid, snapToGridWithOffset } from "../utils/geometry";

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
  /** 配管中間点(エルボ)位置を更新する: index番目のコーナーをx,yに */
  onUpdatePipePoint?: (
    id: string,
    pipeType: PipeType,
    index: number,
    x: number,
    y: number
  ) => void;
  /** 配管に新しいコーナーを追加（index位置に挿入） */
  onInsertPipePoint?: (
    id: string,
    pipeType: PipeType,
    index: number,
    x: number,
    y: number
  ) => void;
  /** 配管コーナーを削除 */
  onRemovePipePoint?: (
    id: string,
    pipeType: PipeType,
    index: number
  ) => void;
  /** 配管ルート選択中(設備ID + 管種) */
  selectedPipeRoute?: { fixtureId: string; pipeType: PipeType } | null;
  /** 配管ルート選択コールバック */
  onSelectPipeRoute?: (
    sel: { fixtureId: string; pipeType: PipeType } | null
  ) => void;
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
  /** グリッドオフセット(mm) - グリッドを動かして図面に合わせる用 */
  gridOffsetMm?: { x: number; y: number };
  /** グリッドオフセットを直接設定 */
  onSetGridOffset?: (x: number, y: number) => void;
  /** マウス位置(キャンバスmm座標)が変わるたびに通知。ステータスバー表示用 */
  onCursorMmChange?: (x: number, y: number) => void;
  /** レイヤー表示制御（電気CAD風のレイヤパネルから） */
  layerVisibility?: {
    background: boolean;
    fixtures: boolean;
    pipes: boolean;
    drains: boolean;
    markers: boolean;
    grid: boolean;
  };
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
  onUpdatePipePoint,
  onInsertPipePoint,
  onRemovePipePoint,
  selectedPipeRoute,
  onSelectPipeRoute,
  onScaleBackground: _onScaleBackground,
  calibrationMode,
  onCalibrationDone,
  bgDragMode,
  bgSnapStepMm,
  markingMode,
  onAddMarker,
  gridOffsetMm,
  onSetGridOffset,
  onCursorMmChange,
  layerVisibility,
}: Props) {
  // レイヤー可視性。指定されていなければ全部 ON。
  const lv = {
    background: layerVisibility?.background ?? true,
    fixtures: layerVisibility?.fixtures ?? true,
    pipes: layerVisibility?.pipes ?? true,
    drains: layerVisibility?.drains ?? true,
    markers: layerVisibility?.markers ?? true,
    grid: layerVisibility?.grid ?? true,
  };
  const gridOffX = gridOffsetMm?.x ?? 0;
  const gridOffY = gridOffsetMm?.y ?? 0;
  // _onScaleBackground は API 互換のため受け取り、実際の計算は親で onCalibrationDone 経由
  void _onScaleBackground;
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // スクロールコンテナを取得 + 操作するためのヘルパー。
  // (react-hooks/immutability lint が ref 経由の直接代入を検出するため、
  //  この関数経由で書き換える形に集約する)
  const getScrollContainer = (): HTMLElement | null =>
    containerRef.current?.parentElement ?? null;
  const setScrollPosition = (left: number, top: number) => {
    const el = getScrollContainer();
    if (!el) return;
    el.scrollLeft = left;
    el.scrollTop = top;
  };
  const [scale, setScale] = useState<number>(DEFAULT_SCALE);
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
  // エルボ(配管中間点)ドラッグ中状態 - 対象コーナーのindexも保持
  const [elbowDragging, setElbowDragging] = useState<{
    fixtureId: string;
    pipeType: PipeType;
    cornerIndex: number;
  } | null>(null);
  // 配管ホバー中(設備ID + 管種)
  const [hoverPipe, setHoverPipe] = useState<{
    fixtureId: string;
    pipeType: PipeType;
  } | null>(null);
  // 線分ドラッグ中(セグメントを平行移動。直交配管維持のため水平/垂直軸に制限)
  const [segmentDragging, setSegmentDragging] = useState<{
    fixtureId: string;
    pipeType: PipeType;
    /** 線分の前端コーナーindex(=points[i]がpoints[i+1]とで作る線の i)。-1 は始点側 */
    segmentIndex: number;
    /** "h"=水平線分(上下に動く), "v"=垂直線分(左右に動く) */
    axis: "h" | "v";
    /** ドラッグ開始時のマウスmm座標 */
    startMm: { x: number; y: number };
    /** ドラッグ開始時の points 配列(後で差分復元用) */
    startPoints: Array<{ x: number; y: number }>;
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
  // ArchiTrend式 両ボタンドラッグ: 押下時の点を保持。離した時の方向で機能切替
  const [dualBtnDrag, setDualBtnDrag] = useState<{
    startMm: { x: number; y: number };
    startClientX: number;
    startClientY: number;
    currentClientX: number;
    currentClientY: number;
  } | null>(null);
  // 「前倍率」用の直前のスケール履歴（左下方向ドラッグで戻すため）
  const [prevScaleStack, setPrevScaleStack] = useState<number[]>([]);
  // 中ボタンドラッグでのパン
  const [panDrag, setPanDrag] = useState<{
    startClientX: number;
    startClientY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);
  // 右クリックポップアップメニュー
  const [contextMenu, setContextMenu] = useState<{
    clientX: number;
    clientY: number;
  } | null>(null);
  // (互換のため zoomBox エイリアス)
  const zoomBox = dualBtnDrag
    ? {
        startMm: dualBtnDrag.startMm,
        currentMm: { x: dualBtnDrag.startMm.x, y: dualBtnDrag.startMm.y },
      }
    : null;

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
        onSetGridOffset &&
        (e.key === "ArrowUp" ||
          e.key === "ArrowDown" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight")
      ) {
        // グリッド移動モードON+設備未選択なら、十字キーでグリッドオフセットを動かす
        e.preventDefault();
        const step = bgSnapStepMm ?? gridSizeMm;
        const mod = (v: number, s: number) => ((v % s) + s) % s;
        let nx = gridOffX;
        let ny = gridOffY;
        if (e.key === "ArrowUp") ny -= step;
        if (e.key === "ArrowDown") ny += step;
        if (e.key === "ArrowLeft") nx -= step;
        if (e.key === "ArrowRight") nx += step;
        onSetGridOffset(mod(nx, gridSizeMm), mod(ny, gridSizeMm));
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
    gridOffX,
    gridOffY,
    bgDragMode,
    bgSnapStepMm,
    backgroundImage,
    onDeleteFixture,
    onRotateFixture,
    onSelectFixture,
    onSetDrainOffset,
    onSetGridOffset,
  ]);

  // --- ホイールズーム（カーソル位置を中心に拡大／縮小: ArchiTrend仕様） ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scrollEl = container.parentElement;
      if (!scrollEl) return;

      // 倍率変更: 拡大は1.1倍、縮小は1/1.1倍(乗算で滑らか)
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      setScale((prev) => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * factor));
        if (next === prev) return prev;

        // カーソル位置のキャンバス座標をmm単位で取得
        const rect = container.querySelector("svg")?.getBoundingClientRect();
        if (!rect) return next;
        const cursorPxFromSvgLeft = e.clientX - rect.left;
        const cursorPxFromSvgTop = e.clientY - rect.top;
        const cursorMmX = cursorPxFromSvgLeft / prev;
        const cursorMmY = cursorPxFromSvgTop / prev;

        // 新スケール後の同じmm点のpx座標
        const newCursorPxX = cursorMmX * next;
        const newCursorPxY = cursorMmY * next;

        // 「新px - 旧px」分だけスクロール調整 → カーソル位置のmm点が画面上同じ場所に残る
        requestAnimationFrame(() => {
          scrollEl.scrollLeft += newCursorPxX - cursorPxFromSvgLeft;
          scrollEl.scrollTop += newCursorPxY - cursorPxFromSvgTop;
        });
        return next;
      });
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
      // グリッド移動モードがONのときのみ、背景クリックでグリッドオフセットドラッグを開始
      if (!bgDragMode || !onSetGridOffset) return;
      if (placingType || calibrationMode) return;
      e.stopPropagation();
      const pos = getMouseMm(e);
      setBgDragging({
        startMouseX: pos.x,
        startMouseY: pos.y,
        // 開始時のグリッドオフセットを保持
        startX: gridOffX,
        startY: gridOffY,
      });
    },
    [bgDragMode, onSetGridOffset, placingType, calibrationMode, gridOffX, gridOffY, getMouseMm]
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
    (e: React.MouseEvent, fixtureId: string, pipeType: PipeType, cornerIndex: number) => {
      e.stopPropagation();
      setElbowDragging({ fixtureId, pipeType, cornerIndex });
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // グリッド移動モードのドラッグ → グリッドオフセットを変更
      if (bgDragging && onSetGridOffset) {
        const pos = getMouseMm(e);
        const dx = pos.x - bgDragging.startMouseX;
        const dy = pos.y - bgDragging.startMouseY;
        // ドラッグ開始時のオフセットからの差分でオフセット更新
        // bgDragging.startX/Y には開始時の gridOffset を入れている
        const step = bgSnapStepMm ?? gridSizeMm;
        const newOffX = snapToGrid(bgDragging.startX + dx, step);
        const newOffY = snapToGrid(bgDragging.startY + dy, step);
        // オフセット値は[0, gridSize)に正規化
        const mod = (v: number, s: number) => ((v % s) + s) % s;
        onSetGridOffset(mod(newOffX, gridSizeMm), mod(newOffY, gridSizeMm));
        return;
      }
      // エルボドラッグ - 指定インデックスのコーナーを更新 (Alt押下でスナップ無効)
      if (elbowDragging && onUpdatePipePoint) {
        const pos = getMouseMm(e);
        const noSnap = e.altKey;
        const newX = noSnap ? pos.x : snapToGridWithOffset(pos.x, gridSizeMm, gridOffX);
        const newY = noSnap ? pos.y : snapToGridWithOffset(pos.y, gridSizeMm, gridOffY);
        onUpdatePipePoint(
          elbowDragging.fixtureId,
          elbowDragging.pipeType,
          elbowDragging.cornerIndex,
          newX,
          newY
        );
        return;
      }
      // 線分ドラッグ - 軸方向のみに平行移動。前後の中間点を追従更新
      if (
        segmentDragging &&
        onUpdatePipePoint &&
        onInsertPipePoint &&
        getMouseMm
      ) {
        const pos = getMouseMm(e);
        const seg = segmentDragging;
        const a0 = seg.startPoints[seg.segmentIndex];
        const b0 = seg.startPoints[seg.segmentIndex + 1];
        if (!a0 || !b0) return;

        // 動かす方向の差分を計算 (axis="h": 上下=Y軸 / "v": 左右=X軸)
        // Alt押下中はスナップ無効
        const noSnap = e.altKey;
        const targetMm =
          seg.axis === "h"
            ? noSnap
              ? pos.y
              : snapToGridWithOffset(pos.y, gridSizeMm, gridOffY)
            : noSnap
              ? pos.x
              : snapToGridWithOffset(pos.x, gridSizeMm, gridOffX);

        // a, b 両端を新位置に移動。両端は corner の場合のみ動かせる(始点/終点は固定)。
        // segmentIndex=0 の場合 a0 は始点(設備接続点)→ a 側は動かさず b のみ
        // segmentIndex=last の場合 b0 は終点(PS) → b 側は動かさず a のみ
        const last = seg.startPoints.length - 1;

        const moveA = seg.segmentIndex !== 0; // 始点でなければ a を動かす
        const moveB = seg.segmentIndex !== last - 1; // 終点でなければ b を動かす

        // 編集後の各 corner を計算して onUpdatePipePoint
        // points[0]=from(設備),points[last]=to(PS) で固定。
        // customPipePoints は points[1..last-1] = corners
        // よって corner index = pointIndex - 1
        if (moveA) {
          const idx = seg.segmentIndex - 1; // a の corner index
          const newA =
            seg.axis === "h"
              ? { x: a0.x, y: targetMm }
              : { x: targetMm, y: a0.y };
          onUpdatePipePoint(
            seg.fixtureId,
            seg.pipeType,
            idx,
            newA.x,
            newA.y
          );
        }
        if (moveB) {
          const idx = seg.segmentIndex; // b の corner index
          const newB =
            seg.axis === "h"
              ? { x: b0.x, y: targetMm }
              : { x: targetMm, y: b0.y };
          onUpdatePipePoint(
            seg.fixtureId,
            seg.pipeType,
            idx,
            newB.x,
            newB.y
          );
        }
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
      const newX = snapToGridWithOffset(pos.x - dragging.offsetX, gridSizeMm, gridOffX);
      const newY = snapToGridWithOffset(pos.y - dragging.offsetY, gridSizeMm, gridOffY);
      onMoveFixture(dragging.id, newX, newY);
    },
    [
      dragging,
      resizing,
      drainDragging,
      elbowDragging,
      bgDragging,
      segmentDragging,
      bgSnapStepMm,
      fixtures,
      getMouseMm,
      gridSizeMm,
      gridOffX,
      gridOffY,
      onMoveFixture,
      onResizeFixtureGeometry,
      onSetDrainOffset,
      onUpdatePipePoint,
      onInsertPipePoint,
      onSetGridOffset,
    ]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setResizing(null);
    setDrainDragging(null);
    setElbowDragging(null);
    setBgDragging(null);
    setSegmentDragging(null);
  }, []);

  /**
   * グリッド線生成（オフセット対応）
   * - 太線 (moduleMm) ごと
   * - 細線 (moduleMm / gridDivision) ごと
   * - グリッド全体を gridOffsetMm.x / .y だけ平行移動して描画
   * iが gridDivision の倍数なら太線（モジュール境界）。
   */
  const gridLines: ReactElement[] = [];
  // オフセット込みで [0, canvasW] / [0, canvasH] をカバーする最初/最後のi
  const startIxX = Math.floor((0 - gridOffX) / gridSizeMm);
  const endIxX = Math.ceil((canvasW - gridOffX) / gridSizeMm);
  const startIxY = Math.floor((0 - gridOffY) / gridSizeMm);
  const endIxY = Math.ceil((canvasH - gridOffY) / gridSizeMm);

  for (let i = startIxX; i <= endIxX; i++) {
    const xMm = gridOffX + i * gridSizeMm;
    if (xMm < -gridSizeMm || xMm > canvasW + gridSizeMm) continue;
    // i が gridDivision の倍数のとき太線（モジュール境界）
    const isMajor = ((i % gridDivision) + gridDivision) % gridDivision === 0;
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
  for (let i = startIxY; i <= endIxY; i++) {
    const yMm = gridOffY + i * gridSizeMm;
    if (yMm < -gridSizeMm || yMm > canvasH + gridSizeMm) continue;
    const isMajor = ((i % gridDivision) + gridDivision) % gridDivision === 0;
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
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* ArchiTrend式 右クリックポップアップメニュー */}
      {contextMenu && (
        <>
          {/* 背景クリック領域(クリックでメニューを閉じる) */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 99,
            }}
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />
          <div
            style={{
              position: "fixed",
              top: contextMenu.clientY,
              left: contextMenu.clientX,
              zIndex: 100,
              background: "#fff",
              border: "1px solid #888",
              boxShadow: "2px 2px 6px rgba(0,0,0,0.25)",
              fontSize: 12,
              minWidth: 160,
              padding: "2px 0",
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <MenuHeader>表示</MenuHeader>
            <MenuItem
              onClick={() => {
                const scrollEl = containerRef.current?.parentElement;
                if (!scrollEl) return setContextMenu(null);
                const t = Math.min(
                  scrollEl.clientWidth / canvasW,
                  scrollEl.clientHeight / canvasH
                ) * 0.95;
                setPrevScaleStack((s) => [...s, scale]);
                setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, t)));
                requestAnimationFrame(() => {
                  scrollEl.scrollLeft = (canvasW / 2) * t - scrollEl.clientWidth / 2;
                  scrollEl.scrollTop = (canvasH / 2) * t - scrollEl.clientHeight / 2;
                });
                setContextMenu(null);
              }}
            >
              全体表示
            </MenuItem>
            <MenuItem
              onClick={() => {
                setPrevScaleStack((s) => [...s, scale]);
                setScale((s) => Math.min(MAX_SCALE, s * 1.5));
                setContextMenu(null);
              }}
            >
              拡大
            </MenuItem>
            <MenuItem
              onClick={() => {
                setPrevScaleStack((s) => [...s, scale]);
                setScale((s) => Math.max(MIN_SCALE, s * 0.7));
                setContextMenu(null);
              }}
            >
              縮小
            </MenuItem>
            <MenuItem
              onClick={() => {
                const last = prevScaleStack[prevScaleStack.length - 1];
                if (last !== undefined) {
                  setPrevScaleStack((s) => s.slice(0, -1));
                  setScale(last);
                }
                setContextMenu(null);
              }}
            >
              前倍率
            </MenuItem>
            <MenuSeparator />
            <MenuHeader>編集</MenuHeader>
            <MenuItem
              disabled={!selectedFixtureId}
              onClick={() => {
                if (selectedFixtureId) onDeleteFixture?.(selectedFixtureId);
                setContextMenu(null);
              }}
            >
              選択要素を削除
            </MenuItem>
            <MenuItem
              disabled={!selectedFixtureId}
              onClick={() => {
                if (selectedFixtureId) onRotateFixture?.(selectedFixtureId);
                setContextMenu(null);
              }}
            >
              選択要素を90°回転
            </MenuItem>
            <MenuItem
              onClick={() => {
                onSelectFixture(null);
                setContextMenu(null);
              }}
            >
              選択解除
            </MenuItem>
          </div>
        </>
      )}

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
          {DEFAULT_CANVAS_W / 1000}×{DEFAULT_CANVAS_H / 1000}m | ホイール=カーソル中心ズーム | 中ボタン=パン | 左+右ドラッグ↘範囲拡大↖縮小↗全体↙前倍率 | 右クリック=メニュー
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
          // 両ボタンドラッグ中・直後 / 中ボタンパン直後 の click は無視
          if (dualBtnDrag || panDrag || contextMenu) return;
          handleCanvasClick(e);
        }}
        onMouseMove={(e) => {
          // マウス座標を親に通知（ステータスバー用）
          if (onCursorMmChange) {
            const p = getMouseMm(e);
            onCursorMmChange(p.x, p.y);
          }
          // 中ボタン(button=4)ドラッグ → パン
          if (panDrag && (e.buttons & 4) === 4) {
            setScrollPosition(
              panDrag.startScrollLeft - (e.clientX - panDrag.startClientX),
              panDrag.startScrollTop - (e.clientY - panDrag.startClientY)
            );
            return;
          }
          // 左+右同時押し中 → ArchiTrend両ボタンドラッグ(現在位置を保持)
          if ((e.buttons & 3) === 3) {
            if (!dualBtnDrag) {
              // 開始
              const pos = getMouseMm(e);
              setDragging(null);
              setBgDragging(null);
              setResizing(null);
              setDrainDragging(null);
              setElbowDragging(null);
              setDualBtnDrag({
                startMm: pos,
                startClientX: e.clientX,
                startClientY: e.clientY,
                currentClientX: e.clientX,
                currentClientY: e.clientY,
              });
            } else {
              setDualBtnDrag({
                ...dualBtnDrag,
                currentClientX: e.clientX,
                currentClientY: e.clientY,
              });
            }
            return;
          }
          handleMouseMove(e);
        }}
        onMouseDown={(e) => {
          // 中ボタン(button=1) → パン開始
          if (e.button === 1) {
            e.preventDefault();
            const scrollEl = containerRef.current?.parentElement;
            setPanDrag({
              startClientX: e.clientX,
              startClientY: e.clientY,
              startScrollLeft: scrollEl?.scrollLeft ?? 0,
              startScrollTop: scrollEl?.scrollTop ?? 0,
            });
            return;
          }
          // 左+右同時押し → 両ボタンドラッグ開始
          if ((e.buttons & 3) === 3) {
            e.preventDefault();
            const pos = getMouseMm(e);
            setDragging(null);
            setBgDragging(null);
            setResizing(null);
            setDrainDragging(null);
            setElbowDragging(null);
            setDualBtnDrag({
              startMm: pos,
              startClientX: e.clientX,
              startClientY: e.clientY,
              currentClientX: e.clientX,
              currentClientY: e.clientY,
            });
          }
        }}
        onMouseUp={(e) => {
          // 中ボタンを離した → パン終了
          if (panDrag && e.button === 1) {
            setPanDrag(null);
            return;
          }
          // 両ボタンドラッグの「離した瞬間」 → 方向判定して機能実行
          if (dualBtnDrag && (e.buttons & 3) !== 3) {
            const dx = dualBtnDrag.currentClientX - dualBtnDrag.startClientX;
            const dy = dualBtnDrag.currentClientY - dualBtnDrag.startClientY;
            const dist = Math.hypot(dx, dy);
            const scrollEl = containerRef.current?.parentElement;
            const viewW = scrollEl?.clientWidth ?? 800;
            const viewH = scrollEl?.clientHeight ?? 600;

            const startMm = dualBtnDrag.startMm;
            const performZoom = (newScale: number, centerMm?: { x: number; y: number }) => {
              setPrevScaleStack((s) => [...s, scale]);
              const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
              setScale(clamped);
              if (centerMm && scrollEl) {
                requestAnimationFrame(() => {
                  scrollEl.scrollLeft = centerMm.x * clamped - viewW / 2;
                  scrollEl.scrollTop = centerMm.y * clamped - viewH / 2;
                });
              }
            };

            if (dist < 5) {
              // 中央(動かさず離す) → シフト: クリック点を画面中心に
              if (scrollEl) {
                requestAnimationFrame(() => {
                  scrollEl.scrollLeft = startMm.x * scale - viewW / 2;
                  scrollEl.scrollTop = startMm.y * scale - viewH / 2;
                });
              }
            } else if (dx > 0 && dy > 0) {
              // 右下 → 範囲拡大(押下点と離した点を対角とする矩形を画面に)
              const endX = (dualBtnDrag.currentClientX -
                (scrollEl?.getBoundingClientRect().left ?? 0) +
                (scrollEl?.scrollLeft ?? 0)) / scale;
              const endY = (dualBtnDrag.currentClientY -
                (scrollEl?.getBoundingClientRect().top ?? 0) +
                (scrollEl?.scrollTop ?? 0)) / scale;
              const x1 = Math.min(startMm.x, endX);
              const y1 = Math.min(startMm.y, endY);
              const x2 = Math.max(startMm.x, endX);
              const y2 = Math.max(startMm.y, endY);
              const boxW = x2 - x1;
              const boxH = y2 - y1;
              if (boxW > 50 && boxH > 50) {
                const target = Math.min(viewW / boxW, viewH / boxH) * 0.95;
                performZoom(target, { x: (x1 + x2) / 2, y: (y1 + y2) / 2 });
              }
            } else if (dx < 0 && dy < 0) {
              // 左上 → 縮小(画面中心基準で 0.7倍)
              performZoom(scale * 0.7);
            } else if (dx > 0 && dy < 0) {
              // 右上 → 全体表示(キャンバス全体が画面に収まる倍率)
              const target = Math.min(viewW / canvasW, viewH / canvasH) * 0.95;
              performZoom(target, { x: canvasW / 2, y: canvasH / 2 });
            } else if (dx < 0 && dy > 0) {
              // 左下 → 前倍率に戻す
              const last = prevScaleStack[prevScaleStack.length - 1];
              if (last !== undefined) {
                setPrevScaleStack((s) => s.slice(0, -1));
                setScale(last);
              }
            }
            setDualBtnDrag(null);
            return;
          }
          handleMouseUp();
        }}
        onMouseLeave={() => {
          setDualBtnDrag(null);
          setPanDrag(null);
          handleMouseUp();
        }}
        onContextMenu={(e) => {
          // ブラウザの既定メニューを抑制し、ArchiTrend式の独自ポップアップを出す
          e.preventDefault();
          // 何もコマンド入力中でない場合のみコンテキストメニューを表示
          if (
            !placingType &&
            !calibrationMode &&
            !markingMode &&
            !dualBtnDrag &&
            !panDrag
          ) {
            setContextMenu({ clientX: e.clientX, clientY: e.clientY });
          }
        }}
      >
        {/* 背景平面図(グリッドの後ろに表示) */}
        {lv.background && backgroundImage && (
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
        {lv.markers && backgroundImage?.markers?.map((m, i) => {
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
        {lv.grid && gridLines}

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
        {lv.fixtures &&
          fixtures
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
                fillOpacity={0.55}
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
            {/* 排水溝（水回り設備のみ。ドラッグで位置変更可能。レイヤーOFFで非表示） */}
            {lv.drains && (() => {
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

        {/* 配管ルート(設備の上に灰色の横管として描画。レイヤーOFFで非表示) */}
        {lv.pipes &&
          pipeRoutes.map((route, i) => {
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

          // 選択/ホバー判定
          const isSelected =
            selectedPipeRoute?.fixtureId === route.fixtureId &&
            selectedPipeRoute?.pipeType === route.pipeType;
          const isHover =
            hoverPipe?.fixtureId === route.fixtureId &&
            hoverPipe?.pipeType === route.pipeType;

          return (
            <g key={`route-${i}`}>
              {/* 透明な太いhitライン: ホバー判定/クリック選択/任意位置ドラッグ */}
              <polyline
                points={pts}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(horizStrokePx + 6, 12)}
                style={{ cursor: "pointer" }}
                onMouseEnter={() =>
                  setHoverPipe({
                    fixtureId: route.fixtureId,
                    pipeType: route.pipeType,
                  })
                }
                onMouseLeave={() => setHoverPipe(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPipeRoute?.({
                    fixtureId: route.fixtureId,
                    pipeType: route.pipeType,
                  });
                }}
                onMouseDown={(e) => {
                  // 配管線上の任意位置をクリック+ドラッグ → その点にコーナーを生成して
                  // 即ドラッグ状態にする (e.altKey 押下中はスナップ無効)
                  if (e.button !== 0) return;
                  if (!onInsertPipePoint || !onUpdatePipePoint) return;
                  e.stopPropagation();
                  const svg = svgRef.current;
                  if (!svg) return;
                  const rect = svg.getBoundingClientRect();
                  const mx = (e.clientX - rect.left) / scale;
                  const my = (e.clientY - rect.top) / scale;
                  // 最寄りセグメントの判定
                  let bestIdx = 0;
                  let bestDist = Infinity;
                  for (let s = 0; s < route.points.length - 1; s++) {
                    const a = route.points[s];
                    const b = route.points[s + 1];
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const len2 = dx * dx + dy * dy;
                    const t =
                      len2 > 0
                        ? Math.max(
                            0,
                            Math.min(
                              1,
                              ((mx - a.x) * dx + (my - a.y) * dy) / len2
                            )
                          )
                        : 0;
                    const px = a.x + t * dx;
                    const py = a.y + t * dy;
                    const d = Math.hypot(mx - px, my - py);
                    if (d < bestDist) {
                      bestDist = d;
                      bestIdx = s;
                    }
                  }
                  const sx = e.altKey
                    ? mx
                    : snapToGridWithOffset(mx, gridSizeMm, gridOffX);
                  const sy = e.altKey
                    ? my
                    : snapToGridWithOffset(my, gridSizeMm, gridOffY);
                  onInsertPipePoint(
                    route.fixtureId,
                    route.pipeType,
                    bestIdx,
                    sx,
                    sy
                  );
                  // 挿入されたコーナーは customPipePoints の bestIdx 番目
                  setElbowDragging({
                    fixtureId: route.fixtureId,
                    pipeType: route.pipeType,
                    cornerIndex: bestIdx,
                  });
                  onSelectPipeRoute?.({
                    fixtureId: route.fixtureId,
                    pipeType: route.pipeType,
                  });
                }}
                onDoubleClick={(e) => {
                  // ダブルクリックされた位置にコーナーを挿入（最寄りセグメントの index を計算）
                  e.stopPropagation();
                  if (!onInsertPipePoint) return;
                  const svg = svgRef.current;
                  if (!svg) return;
                  const rect = svg.getBoundingClientRect();
                  const mx = (e.clientX - rect.left) / scale;
                  const my = (e.clientY - rect.top) / scale;
                  // 各セグメントへの距離を計算し、最寄りのセグメントを選ぶ
                  let bestIdx = 0;
                  let bestDist = Infinity;
                  for (let s = 0; s < route.points.length - 1; s++) {
                    const a = route.points[s];
                    const b = route.points[s + 1];
                    // 線分上に投影した点との距離
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const len2 = dx * dx + dy * dy;
                    const t =
                      len2 > 0
                        ? Math.max(
                            0,
                            Math.min(1, ((mx - a.x) * dx + (my - a.y) * dy) / len2)
                          )
                        : 0;
                    const px = a.x + t * dx;
                    const py = a.y + t * dy;
                    const d = Math.hypot(mx - px, my - py);
                    if (d < bestDist) {
                      bestDist = d;
                      bestIdx = s;
                    }
                  }
                  // クリック位置をスナップして挿入
                  const sx = snapToGridWithOffset(mx, gridSizeMm, gridOffX);
                  const sy = snapToGridWithOffset(my, gridSizeMm, gridOffY);
                  onInsertPipePoint(
                    route.fixtureId,
                    route.pipeType,
                    bestIdx,
                    sx,
                    sy
                  );
                  onSelectPipeRoute?.({
                    fixtureId: route.fixtureId,
                    pipeType: route.pipeType,
                  });
                }}
              />
              {/* 実体ライン: 選択/ホバー時に強調 */}
              <polyline
                points={pts}
                fill="none"
                stroke={isSelected ? "#1976d2" : isHover ? "#42a5f5" : horizColor}
                strokeWidth={
                  isSelected ? Math.max(horizStrokePx + 2, 3) :
                  isHover ? Math.max(horizStrokePx + 1, 2.5) :
                  horizStrokePx
                }
                strokeLinecap="butt"
                strokeLinejoin="miter"
                strokeDasharray={route.pipeType === "vent" ? "4 2" : undefined}
                opacity={isSelected || isHover ? 1 : 0.85}
                pointerEvents="none"
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
          // 選択中設備に紐づく配管の全コーナーハンドル
          //  points = [from, ...corners, to] の corners 部分(中間点群)を編集対象
          //  index は customPipePoints 配列の中のインデックス (=points内のインデックス-1)
          type CornerHandle = {
            pipeType: PipeType;
            point: { x: number; y: number };
            cornerIndex: number;
          };
          // 既存ルートの「セグメント中点」も挿入候補として収集
          type InsertHandle = {
            pipeType: PipeType;
            midPoint: { x: number; y: number };
            insertIndex: number;
          };
          const cornerHandles: CornerHandle[] = [];
          const insertHandles: InsertHandle[] = [];
          pipeRoutes
            .filter((r) => r.fixtureId === sel.id && r.points.length >= 2)
            .forEach((r) => {
              // r.points[0] は from(設備), r.points[最後] は to(PS)
              // 中間 r.points[1..n-1] が corner たち
              for (let i = 1; i < r.points.length - 1; i++) {
                cornerHandles.push({
                  pipeType: r.pipeType,
                  point: r.points[i],
                  cornerIndex: i - 1,
                });
              }
              // 各セグメントの中点(挿入用)
              for (let i = 0; i < r.points.length - 1; i++) {
                const a = r.points[i];
                const b = r.points[i + 1];
                insertHandles.push({
                  pipeType: r.pipeType,
                  midPoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
                  // セグメント i の中点に挿入する場合、新しいコーナーは
                  // points[i] と points[i+1] の間 = customPipePoints の i 番目に挿入
                  insertIndex: i,
                });
              }
            });

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
              {/* 各配管の中間コーナー(緑色)。ドラッグで移動、ダブルクリックで削除 */}
              {cornerHandles.map((eh, ix) => (
                <g key={`corner-${eh.pipeType}-${ix}`}>
                  <circle
                    cx={mmToPx(eh.point.x)}
                    cy={mmToPx(eh.point.y)}
                    r={6}
                    fill="#fff"
                    stroke="#2e7d32"
                    strokeWidth={2}
                    style={{ cursor: "move" }}
                    onMouseDown={(e) => {
                      // 右クリック → 削除
                      if (e.button === 2) {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemovePipePoint?.(sel.id, eh.pipeType, eh.cornerIndex);
                        return;
                      }
                      handleElbowMouseDown(e, sel.id, eh.pipeType, eh.cornerIndex);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemovePipePoint?.(sel.id, eh.pipeType, eh.cornerIndex);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onRemovePipePoint?.(sel.id, eh.pipeType, eh.cornerIndex);
                    }}
                  >
                    <title>ドラッグで移動 / 右クリックまたはダブルクリックで削除 / Alt+ドラッグでスナップ無効</title>
                  </circle>
                  <circle
                    cx={mmToPx(eh.point.x)}
                    cy={mmToPx(eh.point.y)}
                    r={2}
                    fill="#2e7d32"
                    pointerEvents="none"
                  />
                </g>
              ))}
              {/* 各セグメント中点に「+」マーカー。クリックで新コーナーを挿入 */}
              {insertHandles.map((ih, ix) => (
                <g key={`insert-${ih.pipeType}-${ix}`}>
                  <circle
                    cx={mmToPx(ih.midPoint.x)}
                    cy={mmToPx(ih.midPoint.y)}
                    r={4}
                    fill="#fff"
                    stroke="#26a69a"
                    strokeWidth={1.5}
                    strokeDasharray="2 1.5"
                    opacity={0.85}
                    style={{ cursor: "copy" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const snappedX = snapToGridWithOffset(ih.midPoint.x, gridSizeMm, gridOffX);
                      const snappedY = snapToGridWithOffset(ih.midPoint.y, gridSizeMm, gridOffY);
                      onInsertPipePoint?.(
                        sel.id,
                        ih.pipeType,
                        ih.insertIndex,
                        snappedX,
                        snappedY
                      );
                    }}
                  >
                    <title>クリックでこの位置に新しいコーナーを追加</title>
                  </circle>
                  <text
                    x={mmToPx(ih.midPoint.x)}
                    y={mmToPx(ih.midPoint.y) + 1}
                    fontSize={8}
                    fill="#26a69a"
                    fontWeight={700}
                    textAnchor="middle"
                    dominantBaseline="central"
                    pointerEvents="none"
                  >
                    +
                  </text>
                </g>
              ))}
            </g>
          );
        })()}

        {/* 選択中配管の線分ドラッグハンドル: 各セグメントの中点に「↕」「↔」 */}
        {selectedPipeRoute && (() => {
          const route = pipeRoutes.find(
            (r) =>
              r.fixtureId === selectedPipeRoute.fixtureId &&
              r.pipeType === selectedPipeRoute.pipeType
          );
          if (!route || route.points.length < 2) return null;
          return (
            <g>
              {route.points.slice(0, -1).map((a, i) => {
                const b = route.points[i + 1];
                // セグメント方向: x差>y差なら水平線分(縦に動かす), 逆なら垂直線分
                const dx = Math.abs(b.x - a.x);
                const dy = Math.abs(b.y - a.y);
                if (dx === 0 && dy === 0) return null;
                const axis: "h" | "v" = dx >= dy ? "h" : "v";
                const cx = (a.x + b.x) / 2;
                const cy = (a.y + b.y) / 2;
                const cursor = axis === "h" ? "ns-resize" : "ew-resize";
                return (
                  <g key={`segdrag-${i}`}>
                    <rect
                      x={mmToPx(cx) - 7}
                      y={mmToPx(cy) - 7}
                      width={14}
                      height={14}
                      fill="rgba(255,255,255,0.95)"
                      stroke="#1976d2"
                      strokeWidth={1.5}
                      rx={2}
                      style={{ cursor }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const svg = svgRef.current;
                        if (!svg) return;
                        const rect = svg.getBoundingClientRect();
                        setSegmentDragging({
                          fixtureId: route.fixtureId,
                          pipeType: route.pipeType,
                          segmentIndex: i,
                          axis,
                          startMm: {
                            x: (e.clientX - rect.left) / scale,
                            y: (e.clientY - rect.top) / scale,
                          },
                          startPoints: route.points.map((p) => ({ ...p })),
                        });
                      }}
                    >
                      <title>
                        {axis === "h" ? "↕ 水平線分を上下にドラッグ" : "↔ 垂直線分を左右にドラッグ"}
                      </title>
                    </rect>
                    <text
                      x={mmToPx(cx)}
                      y={mmToPx(cy) + 1}
                      fontSize={10}
                      fill="#1976d2"
                      fontWeight={700}
                      textAnchor="middle"
                      dominantBaseline="central"
                      pointerEvents="none"
                    >
                      {axis === "h" ? "↕" : "↔"}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* 配管編集中のルート長表示 - 選択中ルートの現在長さを画面右上に表示 */}
        {selectedPipeRoute && (elbowDragging || segmentDragging) && (() => {
          const r = pipeRoutes.find(
            (rt) =>
              rt.fixtureId === selectedPipeRoute.fixtureId &&
              rt.pipeType === selectedPipeRoute.pipeType
          );
          if (!r) return null;
          // SVG左上付近に固定表示
          const labelW = 180;
          const labelH = 26;
          return (
            <g pointerEvents="none">
              <rect
                x={10}
                y={10}
                width={labelW}
                height={labelH}
                fill="rgba(25,118,210,0.92)"
                rx={3}
              />
              <text
                x={20}
                y={27}
                fontSize={12}
                fill="#fff"
                fontWeight={700}
              >
                {`${r.pipeType} L=${r.lengthMm.toFixed(0)}mm`}
              </text>
            </g>
          );
        })()}

        {/* ArchiTrend式 両ボタンドラッグ中の方向プレビュー(右下=範囲拡大の枠表示) */}
        {dualBtnDrag && (() => {
          const dx = dualBtnDrag.currentClientX - dualBtnDrag.startClientX;
          const dy = dualBtnDrag.currentClientY - dualBtnDrag.startClientY;
          const dist = Math.hypot(dx, dy);
          if (dist < 5) return null;
          const startPx = {
            x: mmToPx(dualBtnDrag.startMm.x),
            y: mmToPx(dualBtnDrag.startMm.y),
          };
          // 右下方向のみ範囲拡大の矩形プレビュー
          if (dx > 0 && dy > 0) {
            return (
              <rect
                x={startPx.x}
                y={startPx.y}
                width={dx}
                height={dy}
                fill="rgba(33,150,243,0.12)"
                stroke="#1976d2"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                pointerEvents="none"
              />
            );
          }
          // それ以外は方向ラベルを起点付近に表示
          const label =
            dx < 0 && dy < 0
              ? "縮小"
              : dx > 0 && dy < 0
                ? "全体表示"
                : dx < 0 && dy > 0
                  ? "前倍率"
                  : "";
          return (
            <g pointerEvents="none">
              <rect
                x={startPx.x - 30}
                y={startPx.y - 12}
                width={60}
                height={20}
                fill="rgba(33,150,243,0.85)"
                rx={2}
              />
              <text
                x={startPx.x}
                y={startPx.y + 2}
                fontSize={11}
                fill="#fff"
                fontWeight={700}
                textAnchor="middle"
              >
                {label}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

// ─── ArchiTrend式コンテキストメニューの構成要素 ─────────────────
function MenuHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "3px 12px",
        fontSize: 10,
        color: "#666",
        background: "#f5f5f5",
        borderBottom: "1px solid #eee",
        fontWeight: 600,
        letterSpacing: 0.5,
      }}
    >
      {children}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        padding: "5px 14px",
        cursor: disabled ? "default" : "pointer",
        color: disabled ? "#aaa" : "#222",
        userSelect: "none",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = "#dbe6f4";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </div>
  );
}

function MenuSeparator() {
  return (
    <div
      style={{
        height: 1,
        background: "#e0e0e0",
        margin: "3px 0",
      }}
    />
  );
}
