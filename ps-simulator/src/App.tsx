import { useState, useMemo } from "react";
import type { FixtureType } from "./domain/types";
import { useSimulatorStore } from "./store/useSimulatorStore";
import { calcPlanSummary } from "./domain/scoring";
import { FixturePalette } from "./components/FixturePalette";
import { GridCanvas } from "./components/GridCanvas";
import { PropertyPanel } from "./components/PropertyPanel";
import { ResultPanel } from "./components/ResultPanel";
import { ComparisonTable } from "./components/ComparisonTable";
import { Toolbar } from "./components/Toolbar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AnchorPicker } from "./components/AnchorPicker";
import { PipeDiameterPanel } from "./components/PipeDiameterPanel";
import { BackgroundPanel } from "./components/BackgroundPanel";
import { LayerPanel } from "./components/LayerPanel";
import type { LayerVisibility } from "./components/LayerPanel";
import { fixtureDefaults } from "./domain/rules/fixtureDefaults";
import type { Anchor } from "./utils/geometry";
import { applyAnchorOffset } from "./utils/geometry";
import { snapToGrid } from "./utils/geometry";
import { exportPlanToJson } from "./utils/exportJson";
import { importPlanFromJson } from "./utils/importJson";

export default function App() {
  const [placingType, setPlacingType] = useState<FixtureType | null>(null);
  // 配置基準点（全設備で共通）。中心がデフォルト = クリック点が設備の中心になる
  const [placingAnchor, setPlacingAnchor] = useState<Anchor>("mc");
  // 図面ドラッグモード（ONのときだけ背景画像が動く）
  const [bgDragMode, setBgDragMode] = useState(false);
  // 背景のスナップ単位 true=モジュール / false=細グリッド
  const [snapToModule, setSnapToModule] = useState(false);
  // 柱マーク追加モード
  const [markingMode, setMarkingMode] = useState(false);
  // 背景図面の校正モード（2点クリックで実距離指定）
  const [calibrationMode, setCalibrationMode] = useState(false);
  // レイヤー可視性（電気CAD風）
  const [layerVis, setLayerVis] = useState<LayerVisibility>({
    background: true,
    grid: true,
    fixtures: true,
    pipes: true,
    drains: true,
    markers: true,
  });
  // マウス座標(キャンバスmm) - ステータスバー用
  const [cursorMm, setCursorMm] = useState({ x: 0, y: 0 });

  const store = useSimulatorStore();

  const selectedFixture =
    store.fixtures.find((f) => f.id === store.selectedFixtureId) ?? null;

  // 現在案のサマリを常時計算
  const currentSummary = useMemo(
    () =>
      calcPlanSummary(
        store.currentPlanName,
        store.fixtures,
        store.pipeRoutes,
        store.slopeResults,
        store.psResults
      ),
    [
      store.currentPlanName,
      store.fixtures,
      store.pipeRoutes,
      store.slopeResults,
      store.psResults,
    ]
  );

  const handlePaletteSelect = (type: FixtureType) => {
    setPlacingType((prev) => (prev === type ? null : type));
  };

  const handleAddFixture = (type: FixtureType, x: number, y: number) => {
    // 全設備で9点アンカー配置を共通利用
    //  1. クリック点をグリッドにスナップ (基準点をグリッド交点に)
    //  2. アンカー位置から左上座標を逆算 (中心/角などを基準にずらす)
    //  3. addFixtureRaw で再スナップせず配置
    const def = fixtureDefaults[type];
    const grid = store.buildingSettings.gridSizeMm;
    const snappedX = snapToGrid(x, grid);
    const snappedY = snapToGrid(y, grid);
    const offset = applyAnchorOffset(
      snappedX,
      snappedY,
      def.w,
      def.h,
      placingAnchor
    );
    store.addFixtureRaw(type, offset.x, offset.y);
    // 配置後は常に配置モードを解除する。
    // (PSも例外なし。連続配置したいときはパレットを再度クリック)
    setPlacingType(null);
  };

  const handleExport = () => {
    const data = store.exportPlanData();
    exportPlanToJson(data);
  };

  const handleImport = async () => {
    try {
      const data = await importPlanFromJson();
      store.importPlanData(data);
    } catch (e) {
      alert(e instanceof Error ? e.message : "読込エラー");
    }
  };

  /**
   * 校正の2点指定が完了したときの処理。
   * 2点間の現状mm距離 → ユーザーが入力する実距離 で倍率を計算し、
   * 背景画像の幅/高さを比例的にスケーリングする。
   */
  const handleCalibrationDone = (
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ) => {
    const bg = store.backgroundImage;
    if (!bg) {
      setCalibrationMode(false);
      return;
    }
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const currentMmDist = Math.sqrt(dx * dx + dy * dy);
    if (currentMmDist <= 0) {
      setCalibrationMode(false);
      return;
    }
    const input = window.prompt(
      `2点間の実距離(mm)を入力してください\n（現状の図面上での距離: ${currentMmDist.toFixed(0)} mm）`,
      "910"
    );
    setCalibrationMode(false);
    if (!input) return;
    const realMm = Number(input);
    if (!isFinite(realMm) || realMm <= 0) {
      alert("有効な数値を入力してください");
      return;
    }
    const factor = realMm / currentMmDist;
    // 中心を保ったままスケール（左上+幅から、新しい左上を再計算）
    store.updateBackgroundImage({
      widthMm: bg.widthMm * factor,
      heightMm: bg.heightMm * factor,
    });
  };

  const handleLoadPlan = (name: string) => {
    const plan = store.savedPlans.find((p) => p.name === name);
    if (plan) {
      store.importPlanData(plan.data);
    }
  };

  return (
    <ErrorBoundary>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          fontFamily:
            "'MS PGothic', 'Yu Gothic UI', 'Segoe UI', 'Hiragino Sans', sans-serif",
          background: "#e8eaed",
          color: "#222",
        }}
      >
        <Toolbar
          planName={store.currentPlanName}
          onPlanNameChange={store.setCurrentPlanName}
          onSave={store.savePlan}
          onExport={handleExport}
          onImport={handleImport}
        />

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* 左: パレット (電気CAD風 - シンボルライブラリ) */}
          <div
            style={{
              width: 144,
              padding: 4,
              background: "#f0f0f0",
              borderRight: "1px solid #b0b0b0",
              overflowY: "auto",
              flexShrink: 0,
            }}
          >
            <FixturePalette
              onSelect={handlePaletteSelect}
              selectedType={placingType}
            />
          </div>

          {/* 中央: グリッド (CAD作業台) */}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: 8,
              background: "#dcdcdc",
            }}
          >
            {calibrationMode && (
              <div
                style={{
                  marginBottom: 6,
                  padding: "6px 10px",
                  background: "#fff8e1",
                  border: "1px solid #ffc107",
                  borderRadius: 4,
                  fontSize: 12,
                  color: "#7a4f01",
                }}
              >
                図面校正モード: 図面上の2点をクリック → 実距離(mm)入力で自動スケール
                <button
                  onClick={() => setCalibrationMode(false)}
                  style={{ marginLeft: 8, fontSize: 11, cursor: "pointer" }}
                >
                  キャンセル
                </button>
              </div>
            )}
            {/* 平面図も設備も無いときの案内 */}
            {!store.backgroundImage &&
              store.fixtures.length === 0 &&
              !calibrationMode && (
                <div
                  style={{
                    marginBottom: 6,
                    padding: "8px 12px",
                    background: "#e3f2fd",
                    border: "1px dashed #1976d2",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "#0d47a1",
                  }}
                >
                  <strong>STEP 1:</strong> 右の「背景平面図」から PNG/JPG/PDF を読み込み →{" "}
                  「2点指定で校正」で実距離を入れてグリッドに合わせてから、設備を配置してください。
                </div>
              )}
            {placingType && (
              <div
                style={{
                  marginBottom: 6,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ fontSize: 12, color: "#1976d2" }}>
                  配置モード: グリッドをクリックして設備を配置 / パレットをもう一度クリックで解除
                </div>
                {/* 全設備で9点アンカーを共通利用しグリッド点に落としやすく */}
                <AnchorPicker
                  label="配置基準点（クリックがこの点に来ます）"
                  value={placingAnchor}
                  onChange={setPlacingAnchor}
                />
              </div>
            )}
            <GridCanvas
              fixtures={store.fixtures}
              pipeRoutes={store.pipeRoutes}
              selectedFixtureId={store.selectedFixtureId}
              gridSizeMm={store.buildingSettings.gridSizeMm}
              gridDivision={store.buildingSettings.gridDivision}
              pipeDiameters={store.pipeDiameters}
              backgroundImage={store.backgroundImage}
              placingType={placingType}
              onAddFixture={handleAddFixture}
              onMoveFixture={store.moveFixture}
              onSelectFixture={store.selectFixture}
              onDeleteFixture={store.deleteFixture}
              onRotateFixture={store.rotateFixture}
              onResizeFixtureGeometry={store.setFixtureGeometry}
              onSetDrainOffset={store.setFixtureDrainOffset}
              onUpdatePipePoint={(id, pipeType, index, x, y) =>
                store.updateCustomPipePoint(id, pipeType, index, x, y)
              }
              onInsertPipePoint={(id, pipeType, index, x, y) =>
                store.insertCustomPipePoint(id, pipeType, index, x, y)
              }
              onRemovePipePoint={(id, pipeType, index) =>
                store.removeCustomPipePoint(id, pipeType, index)
              }
              onMoveBackground={(x, y) =>
                store.updateBackgroundImage({ x, y })
              }
              calibrationMode={calibrationMode}
              onCalibrationDone={handleCalibrationDone}
              bgDragMode={bgDragMode}
              bgSnapStepMm={
                snapToModule
                  ? store.buildingSettings.moduleMm
                  : store.buildingSettings.gridSizeMm
              }
              markingMode={markingMode}
              onAddMarker={(offsetX, offsetY) =>
                store.addBackgroundMarker(offsetX, offsetY)
              }
              gridOffsetMm={store.gridOffsetMm}
              onSetGridOffset={store.setGridOffset}
              layerVisibility={layerVis}
              onCursorMmChange={(x, y) => setCursorMm({ x, y })}
            />
          </div>

          {/* 右: プロパティパネル (電気CAD風) */}
          <div
            style={{
              width: 300,
              padding: 6,
              background: "#f0f0f0",
              borderLeft: "1px solid #b0b0b0",
              overflowY: "auto",
              flexShrink: 0,
              fontSize: 12,
            }}
          >
            {/* レイヤパネル（電気CAD風 - 表示トグル） */}
            <LayerPanel
              visibility={layerVis}
              onChange={(patch) => setLayerVis((v) => ({ ...v, ...patch }))}
            />

            <div style={{ margin: "10px 0", borderTop: "1px solid #ccc" }} />

            {/* STEP1: 平面図取込・スケール調整 */}
            <BackgroundPanel
              backgroundImage={store.backgroundImage}
              onSet={store.setBackgroundImage}
              onUpdate={store.updateBackgroundImage}
              calibrationMode={calibrationMode}
              onToggleCalibration={() => setCalibrationMode((v) => !v)}
              bgDragMode={bgDragMode}
              onToggleBgDragMode={() => setBgDragMode((v) => !v)}
              gridSizeMm={store.buildingSettings.gridSizeMm}
              moduleMm={store.buildingSettings.moduleMm}
              snapToModule={snapToModule}
              onToggleSnapToModule={() => setSnapToModule((v) => !v)}
              markingMode={markingMode}
              onToggleMarkingMode={() => setMarkingMode((v) => !v)}
              onClearMarkers={() => store.clearBackgroundMarkers()}
              onAlignByFirstMarker={() =>
                store.alignGridByMarker(0, store.buildingSettings.gridSizeMm)
              }
              onResetGridOffset={() => store.setGridOffset(0, 0)}
              gridOffsetMm={store.gridOffsetMm}
            />

            <div style={{ margin: "16px 0", borderTop: "1px solid #eee" }} />

            <PropertyPanel
              buildingSettings={store.buildingSettings}
              onUpdateSettings={store.setBuildingSettings}
              selectedFixture={selectedFixture}
              onResize={store.resizeFixture}
              onRotate={store.rotateFixture}
              onDelete={store.deleteFixture}
            />

            <div style={{ margin: "16px 0", borderTop: "1px solid #eee" }} />

            <ResultPanel
              fixtures={store.fixtures}
              slopeResults={store.slopeResults}
              psResults={store.psResults}
            />

            <div style={{ margin: "16px 0", borderTop: "1px solid #eee" }} />

            <PipeDiameterPanel
              pipeDiameters={store.pipeDiameters}
              onChange={store.setPipeDiameter}
            />

            <div style={{ margin: "16px 0", borderTop: "1px solid #eee" }} />

            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>案比較</h3>
            <ComparisonTable
              currentSummary={currentSummary}
              savedPlans={store.savedPlans}
              onDelete={store.deleteSavedPlan}
              onLoad={handleLoadPlan}
            />
          </div>
        </div>

        {/* 下部ステータスバー (電気CAD風) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#f0f0f0",
            borderTop: "1px solid #b0b0b0",
            padding: "2px 8px",
            fontSize: 11,
            color: "#333",
          }}
        >
          <div
            style={{
              padding: "1px 8px",
              background: "#fff",
              border: "1px solid #c0c0c0",
              fontWeight: 600,
            }}
          >
            1階 平面図
          </div>
          <div>
            設備 {store.fixtures.length} / 配管 {store.pipeRoutes.length}
          </div>
          <div
            style={{
              padding: "1px 6px",
              background: "#fff",
              border: "1px solid #c0c0c0",
              fontFamily: "Consolas, 'Courier New', monospace",
              minWidth: 150,
              textAlign: "center",
            }}
          >
            X: {cursorMm.x.toFixed(0).padStart(6, " ")} Y:{" "}
            {cursorMm.y.toFixed(0).padStart(6, " ")}
          </div>
          <div style={{ flex: 1 }} />
          <div>
            モジュール: {store.buildingSettings.moduleMm}÷
            {store.buildingSettings.gridDivision}={" "}
            {store.buildingSettings.gridSizeMm}mm
          </div>
          <div>
            グリッド: ({store.gridOffsetMm.x.toFixed(0)},{" "}
            {store.gridOffsetMm.y.toFixed(0)})
          </div>
          <div
            style={{
              padding: "1px 6px",
              background: "#fff",
              border: "1px solid #c0c0c0",
            }}
          >
            S=1/100
          </div>
          <div
            style={{
              padding: "1px 6px",
              background:
                placingType || calibrationMode || markingMode || bgDragMode
                  ? "#ffeb3b"
                  : "#e0e0e0",
              border: "1px solid #999",
              fontWeight: 600,
            }}
          >
            {placingType
              ? `配置:${placingType}`
              : calibrationMode
              ? "校正中"
              : markingMode
              ? "柱マーク"
              : bgDragMode
              ? "グリッド移動"
              : "選択"}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
