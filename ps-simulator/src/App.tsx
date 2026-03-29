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
import { exportPlanToJson } from "./utils/exportJson";
import { importPlanFromJson } from "./utils/importJson";

export default function App() {
  const [placingType, setPlacingType] = useState<FixtureType | null>(null);

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
    store.addFixture(type, x, y);
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
            {placingType && (
              <div
                style={{
                  marginBottom: 6,
                  fontSize: 12,
                  color: "#1976d2",
                }}
              >
                配置モード: グリッドをクリックして設備を配置 / パレットをもう一度クリックで解除
              </div>
            )}
            <GridCanvas
              fixtures={store.fixtures}
              pipeRoutes={store.pipeRoutes}
              selectedFixtureId={store.selectedFixtureId}
              gridSizeMm={store.buildingSettings.gridSizeMm}
              placingType={placingType}
              onAddFixture={handleAddFixture}
              onMoveFixture={store.moveFixture}
              onSelectFixture={store.selectFixture}
              onDeleteFixture={store.deleteFixture}
              onRotateFixture={store.rotateFixture}
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
