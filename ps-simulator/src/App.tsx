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
  // 背景図面の校正モード（2点クリックで実距離指定）
  const [calibrationMode, setCalibrationMode] = useState(false);

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
    if (type !== "ps") {
      setPlacingType(null);
    }
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
          fontFamily: "'Segoe UI', 'Hiragino Sans', sans-serif",
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
          {/* 左: パレット */}
          <div
            style={{
              width: 140,
              padding: 10,
              borderRight: "1px solid #ddd",
              overflowY: "auto",
              flexShrink: 0,
            }}
          >
            <FixturePalette
              onSelect={handlePaletteSelect}
              selectedType={placingType}
            />
          </div>

          {/* 中央: グリッド */}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: 10,
              background: "#fafafa",
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
              onSetPipeMidPoint={(id, pipeType, x, y) =>
                store.setCustomPipeMidPoint(id, pipeType, x, y)
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
            />
          </div>

          {/* 右: 設定 + 結果 */}
          <div
            style={{
              width: 300,
              padding: 10,
              borderLeft: "1px solid #ddd",
              overflowY: "auto",
              flexShrink: 0,
            }}
          >
            {/* STEP1: 平面図取込・スケール調整（最上部、最も目立つ） */}
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
      </div>
    </ErrorBoundary>
  );
}
