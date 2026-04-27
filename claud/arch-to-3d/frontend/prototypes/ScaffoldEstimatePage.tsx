import { useState, useRef, ChangeEvent, useMemo } from "react";
import PdfMeasureCanvas, {
  Polygon,
  DrawMode,
  NPoint,
} from "../components/PdfMeasureCanvas";

const MAX_BASE_WIDTH = 900;
const MAX_BASE_HEIGHT = 900;

type ScaffoldKind = "kusabi" | "tankan" | "wakugumi" | "tsuri";
type ScaffoldType = "ichigawa" | "nigawa" | "souashiba" | "tsuri";

interface UnitPriceMaster {
  kusabi: number; // くさび緊結式 円/m²
  tankan: number; // 単管 円/m²
  wakugumi: number; // 枠組 円/m²
  tsuri: number; // 吊り 円/m²
  meshSheet: number; // メッシュシート 円/m²
  soundSheet: number; // 防音シート 円/m²
  stair: number; // 昇降階段 円/基
}

const DEFAULT_UNIT_PRICES: UnitPriceMaster = {
  kusabi: 1200,
  tankan: 1500,
  wakugumi: 1400,
  tsuri: 3000,
  meshSheet: 200,
  soundSheet: 350,
  stair: 30000,
};

export default function ScaffoldEstimatePage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ w: number; h: number }>({
    w: 600,
    h: 600,
  });
  const [polygons, setPolygons] = useState<Polygon[]>([]);
  const [drawMode, setDrawMode] = useState<DrawMode>("none");
  const [scale, setScale] = useState<number | null>(null); // m²/px²
  const [orthoMode, setOrthoMode] = useState(true);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [calibPending, setCalibPending] = useState<{
    pixelDist: number;
    polyId: string;
  } | null>(null);
  const [realDistInput, setRealDistInput] = useState("");
  const [selectedPolyId, setSelectedPolyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 足場仕様
  const [floors, setFloors] = useState(2);
  const [floorHeight, setFloorHeight] = useState(2.8);
  const [eaveCorrection, setEaveCorrection] = useState(true);
  const [scaffoldKind, setScaffoldKind] = useState<ScaffoldKind>("kusabi");
  const [scaffoldType, setScaffoldType] = useState<ScaffoldType>("souashiba");
  const [useMesh, setUseMesh] = useState(true);
  const [useSoundSheet, setUseSoundSheet] = useState(false);
  const [stairCount, setStairCount] = useState(1);
  const [unitPrices, setUnitPrices] =
    useState<UnitPriceMaster>(DEFAULT_UNIT_PRICES);

  // --- Derived sizes ---
  const aspect = imageSize.h / Math.max(imageSize.w, 1);
  const baseWidth = Math.round(
    Math.min(MAX_BASE_WIDTH, MAX_BASE_HEIGHT / aspect),
  );
  const baseHeight = Math.round(baseWidth * aspect);
  const zoomedWidth = Math.round(baseWidth * pdfScale);
  const zoomedHeight = Math.round(baseHeight * pdfScale);

  // --- File handling ---
  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(f);
    setImageUrl(url);
    const img = new Image();
    img.onload = () => setImageSize({ w: img.width, h: img.height });
    img.src = url;
    setPolygons([]);
    setScale(null);
    setCalibPending(null);
    setRealDistInput("");
    setDrawMode("none");
  }

  // --- Calibration ---
  function startCalibration() {
    setPolygons((prev) => prev.filter((p) => p.type !== "line"));
    setScale(null);
    setPolygons((prev) =>
      prev.map((p) =>
        p.type === "area" || p.type === "rect"
          ? { ...p, realValue: undefined }
          : p,
      ),
    );
    setCalibPending(null);
    setRealDistInput("");
    setDrawMode("line");
  }

  function handleShapeComplete(poly: Polygon) {
    if (poly.type === "line" && !scale && !calibPending) {
      const pts = poly.points;
      let pxLen = 0;
      for (let i = 1; i < pts.length; i++) {
        const dx = (pts[i].x - pts[i - 1].x) * baseWidth;
        const dy = (pts[i].y - pts[i - 1].y) * baseHeight;
        pxLen += Math.sqrt(dx * dx + dy * dy);
      }
      setCalibPending({ pixelDist: pxLen, polyId: poly.id });
      setDrawMode("none");
    }
  }

  function confirmCalibration() {
    if (!calibPending) return;
    const realM = parseFloat(realDistInput);
    if (!realM || realM <= 0) return;
    const metersPerPixel = realM / calibPending.pixelDist;
    const s = metersPerPixel * metersPerPixel;
    setScale(s);
    setPolygons((prev) =>
      prev.map((p) => {
        if (p.id === calibPending.polyId) {
          return { ...p, label: `基準 ${realM}m`, realValue: realM };
        }
        if (p.type === "area" || p.type === "rect") {
          return {
            ...p,
            realValue: polygonPixelArea(p.points, baseWidth, baseHeight) * s,
          };
        }
        return p;
      }),
    );
    setCalibPending(null);
    setRealDistInput("");
  }

  function cancelCalibration() {
    if (!calibPending) return;
    setPolygons((prev) => prev.filter((p) => p.id !== calibPending.polyId));
    setCalibPending(null);
    setRealDistInput("");
  }

  function handleShapeModified(poly: Polygon) {
    if (!scale) return;
    if (poly.type === "area" || poly.type === "rect") {
      setPolygons((prev) =>
        prev.map((p) =>
          p.id === poly.id
            ? {
                ...p,
                realValue:
                  polygonPixelArea(p.points, baseWidth, baseHeight) * scale,
              }
            : p,
        ),
      );
    }
  }

  function deletePoly(id: string) {
    setPolygons((prev) => prev.filter((p) => p.id !== id));
    if (selectedPolyId === id) setSelectedPolyId(null);
  }

  function renamePoly(id: string, label: string) {
    setPolygons((prev) =>
      prev.map((p) => (p.id === id ? { ...p, label } : p)),
    );
  }

  const buildings = polygons.filter(
    (p) => p.type === "area" || p.type === "rect",
  );

  // --- 周長計算（建物ポリゴンの実周長合計）---
  const totalPerimeter = useMemo(() => {
    if (!scale) return 0;
    const mPerPx = Math.sqrt(scale); // 1px → m
    return buildings.reduce(
      (sum, p) => sum + polygonPerimeterPx(p.points, baseWidth, baseHeight) * mPerPx,
      0,
    );
  }, [buildings, scale, baseWidth, baseHeight]);

  const totalFloorArea = buildings.reduce(
    (sum, p) => sum + (p.realValue ?? 0),
    0,
  );

  // --- 足場計算 ---
  const buildingHeight = floors * floorHeight + (eaveCorrection ? 1.0 : 0);
  const scaffoldAreaBase = totalPerimeter * buildingHeight; // 掛m²
  const typeMultiplier = scaffoldType === "tsuri" ? 1.5 : 1.0;
  const scaffoldArea = scaffoldAreaBase * typeMultiplier;

  const scaffoldUnitPrice =
    scaffoldType === "tsuri" ? unitPrices.tsuri : unitPrices[scaffoldKind];

  const scaffoldCost = Math.round(scaffoldArea * scaffoldUnitPrice);
  const meshCost = useMesh ? Math.round(scaffoldArea * unitPrices.meshSheet) : 0;
  const soundCost = useSoundSheet
    ? Math.round(scaffoldArea * unitPrices.soundSheet)
    : 0;
  const stairCost = stairCount * unitPrices.stair;
  const totalCost = scaffoldCost + meshCost + soundCost + stairCost;

  // 内訳行
  interface BreakdownRow {
    name: string;
    qty: number;
    unit: string;
    unitPrice: number;
    amount: number;
  }
  const breakdown: BreakdownRow[] = [
    {
      name: scaffoldKindLabel(scaffoldType, scaffoldKind),
      qty: round2(scaffoldArea),
      unit: "m²",
      unitPrice: scaffoldUnitPrice,
      amount: scaffoldCost,
    },
  ];
  if (useMesh) {
    breakdown.push({
      name: "メッシュシート",
      qty: round2(scaffoldArea),
      unit: "m²",
      unitPrice: unitPrices.meshSheet,
      amount: meshCost,
    });
  }
  if (useSoundSheet) {
    breakdown.push({
      name: "防音シート",
      qty: round2(scaffoldArea),
      unit: "m²",
      unitPrice: unitPrices.soundSheet,
      amount: soundCost,
    });
  }
  if (stairCount > 0) {
    breakdown.push({
      name: "昇降階段",
      qty: stairCount,
      unit: "基",
      unitPrice: unitPrices.stair,
      amount: stairCost,
    });
  }

  // --- CSV export ---
  function exportCSV() {
    const yyyymmdd = formatDate(new Date());
    const header = "番号,項目,数量,単位,単価(円),金額(円)\n";
    const rows = breakdown
      .map(
        (r, i) =>
          `${i + 1},${r.name},${r.qty},${r.unit},${r.unitPrice},${r.amount}`,
      )
      .join("\n");
    const total = `\n,合計,,,,${totalCost}`;
    const meta =
      `\n\n# 計算条件\n周長(m),${totalPerimeter.toFixed(2)}\n` +
      `建物高さ(m),${buildingHeight.toFixed(2)}\n` +
      `階数,${floors}\n階高(m),${floorHeight}\n` +
      `軒先補正,${eaveCorrection ? "あり(+1.0m)" : "なし"}\n` +
      `足場種別,${scaffoldTypeLabel(scaffoldType)}\n` +
      `掛m²,${scaffoldArea.toFixed(2)}`;
    const csv = header + rows + total + meta;
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `足場見積_${yyyymmdd}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="est-shell">
      <header className="est-header">
        <h1 className="est-title">🏗️ 足場見積もりシミュレーター</h1>
        <p className="est-subtitle">
          平面図から建物外周をトレース → 階数・足場種別を選んで仮設足場の概算見積もりを算出
        </p>
      </header>

      {/* STEP 1: image upload */}
      <section className="panel est-panel">
        <h2 className="est-section-title">STEP 1：図面を読み込み</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleFile}
          style={{ display: "none" }}
        />
        <button
          type="button"
          className="est-btn est-btn--primary"
          onClick={() => fileInputRef.current?.click()}
        >
          📷 画像を選択（PNG / JPG）
        </button>
        {imageUrl && (
          <span style={{ marginLeft: 12, fontSize: "0.9rem", color: "#555" }}>
            ✓ 画像読み込み済み（{imageSize.w}×{imageSize.h}px）
          </span>
        )}
        <p className="est-section-desc" style={{ marginTop: 8 }}>
          ヒント：建物の平面図 / 配置図 / 航空写真など。スケールバーや既知寸法が写っていると STEP 2 で寸法合わせが正確になります。
        </p>
      </section>

      {imageUrl && (
        <>
          {/* STEP 2 + 3: Canvas + tools */}
          <section className="panel est-panel">
            <div className="est-pdf-toolbar">
              <h2 className="est-panel-title" style={{ margin: 0 }}>
                図面ツール
              </h2>
              <div className="est-draw-tools">
                <button
                  type="button"
                  className={`est-tool-btn ${
                    drawMode === "line" ? "est-tool-btn--active" : ""
                  }`}
                  onClick={startCalibration}
                  title="STEP 2：2点クリック＋実距離(m)入力でスケール設定"
                >
                  📏 STEP 2 スケール設定（2点）
                </button>
                <button
                  type="button"
                  className={`est-tool-btn ${
                    drawMode === "area" ? "est-tool-btn--active" : ""
                  }`}
                  onClick={() =>
                    setDrawMode(drawMode === "area" ? "none" : "area")
                  }
                  disabled={!scale}
                  title={
                    scale
                      ? "STEP 3：建物外周を多角形でトレース"
                      : "先にスケールを設定してください"
                  }
                >
                  🏠 STEP 3 建物外周（多角形）
                </button>
                <button
                  type="button"
                  className={`est-tool-btn ${
                    drawMode === "rect" ? "est-tool-btn--active" : ""
                  }`}
                  onClick={() =>
                    setDrawMode(drawMode === "rect" ? "none" : "rect")
                  }
                  disabled={!scale}
                  title={
                    scale
                      ? "建物外周を矩形でトレース"
                      : "先にスケールを設定してください"
                  }
                >
                  🟦 建物外周（矩形）
                </button>
                {drawMode !== "none" && (
                  <button
                    type="button"
                    className="est-tool-btn"
                    onClick={() => setDrawMode("none")}
                  >
                    ✖ 描画終了
                  </button>
                )}
              </div>
            </div>

            <div className="est-pdf-draw-area">
              <div className="est-pdf-controls">
                <button
                  type="button"
                  className="est-pdf-btn"
                  onClick={() => setPdfScale((s) => Math.max(0.5, s - 0.15))}
                >
                  −
                </button>
                <span className="est-pdf-zoom">
                  {Math.round(pdfScale * 100)}%
                </span>
                <button
                  type="button"
                  className="est-pdf-btn"
                  onClick={() => setPdfScale((s) => Math.min(3, s + 0.15))}
                >
                  ＋
                </button>
                <button
                  type="button"
                  className="est-pdf-btn"
                  onClick={() => setPdfScale(1.0)}
                  style={{ width: "auto", padding: "0 8px", fontSize: "0.78rem" }}
                >
                  リセット
                </button>
                <span className="est-pdf-sep">|</span>
                <button
                  type="button"
                  className={`est-pdf-btn ${
                    orthoMode ? "est-pdf-btn--active" : ""
                  }`}
                  onClick={() => setOrthoMode((v) => !v)}
                  style={{ width: "auto", padding: "0 8px", fontSize: "0.78rem" }}
                  title="定規モード：辺を水平・垂直にスナップ（建物の矩形トレースに便利）"
                >
                  {orthoMode ? "📐 定規ON" : "📐 定規OFF"}
                </button>
              </div>
              <div className="est-pdf-scroll">
                <div
                  className="est-pdf-canvas-wrap"
                  style={{
                    position: "relative",
                    width: zoomedWidth,
                    height: zoomedHeight,
                  }}
                >
                  <img
                    src={imageUrl}
                    alt=""
                    style={{
                      display: "block",
                      width: zoomedWidth,
                      height: zoomedHeight,
                      userSelect: "none",
                      pointerEvents: "none",
                    }}
                    draggable={false}
                  />
                  <PdfMeasureCanvas
                    width={zoomedWidth}
                    height={zoomedHeight}
                    baseWidth={baseWidth}
                    baseHeight={baseHeight}
                    drawMode={drawMode}
                    polygons={polygons}
                    scale={scale}
                    onPolygonsChange={setPolygons}
                    onShapeComplete={handleShapeComplete}
                    onShapeModified={handleShapeModified}
                    selectedPolyId={selectedPolyId}
                    onSelectPoly={setSelectedPolyId}
                    orthoMode={orthoMode}
                  />
                </div>
              </div>
            </div>

            {calibPending && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  background: "#fff4e6",
                  border: "1px solid #ff8800",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontWeight: 600 }}>
                  📏 クリックした2点の実距離(m)を入力：
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={realDistInput}
                  onChange={(e) => setRealDistInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmCalibration();
                  }}
                  placeholder="例: 10"
                  autoFocus
                  style={{
                    width: 120,
                    padding: "4px 8px",
                    fontSize: "0.95rem",
                  }}
                />
                <span style={{ fontSize: "0.9rem", color: "#555" }}>
                  m (ピクセル距離: {calibPending.pixelDist.toFixed(1)} px)
                </span>
                <button
                  type="button"
                  className="est-btn est-btn--primary"
                  onClick={confirmCalibration}
                  disabled={!parseFloat(realDistInput)}
                >
                  確定
                </button>
                <button
                  type="button"
                  className="est-btn"
                  onClick={cancelCalibration}
                >
                  取消
                </button>
              </div>
            )}

            <p className="est-draw-hint" style={{ marginTop: 10 }}>
              {drawMode === "line"
                ? "スケール基準となる2点をクリック（例: スケールバー両端 / 通り芯間距離など既知寸法）。"
                : !scale
                ? "まず「📏 スケール設定」で基準距離を入力してください。"
                : drawMode === "area"
                ? "建物の外周を順番にクリック。最初の点に戻るかダブルクリックで閉じます。定規ONで直角建物の入力が楽になります。"
                : drawMode === "rect"
                ? "建物外周を矩形で囲む：対角の2点をクリック。"
                : `✓ スケール設定済み（1px ≒ ${Math.sqrt(scale).toFixed(3)} m）。建物外周ツールで建物を囲んでください。`}
            </p>

            {/* 計測バッジ */}
            {scale && buildings.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <Badge color="#1565c0" label={`周長 ${totalPerimeter.toFixed(2)} m`} />
                <Badge color="#2e7d32" label={`建物高さ ${buildingHeight.toFixed(2)} m`} />
                <Badge color="#ef6c00" label={`掛m² ${scaffoldArea.toFixed(2)} m²`} />
                <Badge color="#6a1b9a" label={`床面積合計 ${totalFloorArea.toFixed(2)} m²`} />
              </div>
            )}
          </section>

          {/* STEP 4: 足場仕様 + 見積もり */}
          {scale && (
            <section className="panel est-panel">
              <h2 className="est-section-title">STEP 4：足場仕様の入力</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(280px, 1fr) minmax(280px, 1fr)",
                  gap: 24,
                  alignItems: "start",
                }}
              >
                {/* 仕様フォーム */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <FormRow label="階数">
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={floors}
                      onChange={(e) =>
                        setFloors(
                          Math.max(1, Math.min(5, parseInt(e.target.value) || 1)),
                        )
                      }
                      style={inputStyle}
                    />
                    <span style={unitLabelStyle}>階</span>
                  </FormRow>

                  <FormRow label="階高">
                    <input
                      type="number"
                      step="0.1"
                      min={2}
                      value={floorHeight}
                      onChange={(e) =>
                        setFloorHeight(parseFloat(e.target.value) || 2.8)
                      }
                      style={inputStyle}
                    />
                    <span style={unitLabelStyle}>m</span>
                  </FormRow>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "0.92rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={eaveCorrection}
                      onChange={(e) => setEaveCorrection(e.target.checked)}
                    />
                    軒先補正（+1.0m を建物高さに加算）
                  </label>

                  <fieldset
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 6,
                      padding: "8px 12px",
                    }}
                  >
                    <legend style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                      足場種別
                    </legend>
                    <Radio
                      name="stype"
                      value="ichigawa"
                      checked={scaffoldType === "ichigawa"}
                      onChange={() => setScaffoldType("ichigawa")}
                      label="一側足場（壁面単側、安価）"
                    />
                    <Radio
                      name="stype"
                      value="nigawa"
                      checked={scaffoldType === "nigawa"}
                      onChange={() => setScaffoldType("nigawa")}
                      label="二側足場（両側）"
                    />
                    <Radio
                      name="stype"
                      value="souashiba"
                      checked={scaffoldType === "souashiba"}
                      onChange={() => setScaffoldType("souashiba")}
                      label="総足場（推奨：建物全周）"
                    />
                    <Radio
                      name="stype"
                      value="tsuri"
                      checked={scaffoldType === "tsuri"}
                      onChange={() => setScaffoldType("tsuri")}
                      label="吊り足場（特殊・×1.5）"
                    />
                  </fieldset>

                  {scaffoldType !== "tsuri" && (
                    <fieldset
                      style={{
                        border: "1px solid #ddd",
                        borderRadius: 6,
                        padding: "8px 12px",
                      }}
                    >
                      <legend style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                        足場工法
                      </legend>
                      <Radio
                        name="skind"
                        value="kusabi"
                        checked={scaffoldKind === "kusabi"}
                        onChange={() => setScaffoldKind("kusabi")}
                        label="くさび緊結式（標準）"
                      />
                      <Radio
                        name="skind"
                        value="tankan"
                        checked={scaffoldKind === "tankan"}
                        onChange={() => setScaffoldKind("tankan")}
                        label="単管足場"
                      />
                      <Radio
                        name="skind"
                        value="wakugumi"
                        checked={scaffoldKind === "wakugumi"}
                        onChange={() => setScaffoldKind("wakugumi")}
                        label="枠組足場"
                      />
                    </fieldset>
                  )}

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "0.92rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={useMesh}
                      onChange={(e) => setUseMesh(e.target.checked)}
                    />
                    飛散防止メッシュシート
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "0.92rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={useSoundSheet}
                      onChange={(e) => setUseSoundSheet(e.target.checked)}
                    />
                    防音シート
                  </label>

                  <FormRow label="昇降階段">
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={stairCount}
                      onChange={(e) =>
                        setStairCount(
                          Math.max(0, parseInt(e.target.value) || 0),
                        )
                      }
                      style={inputStyle}
                    />
                    <span style={unitLabelStyle}>基</span>
                  </FormRow>
                </div>

                {/* 単価マスタ（編集可） */}
                <div>
                  <h3
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                    }}
                  >
                    単価マスタ（編集可）
                  </h3>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.88rem",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f5f5f5" }}>
                        <th style={thStyle}>項目</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>単価</th>
                        <th style={thStyle}>単位</th>
                      </tr>
                    </thead>
                    <tbody>
                      <UnitPriceRow
                        label="くさび緊結式"
                        unit="円/m²"
                        value={unitPrices.kusabi}
                        onChange={(v) => setUnitPrices({ ...unitPrices, kusabi: v })}
                      />
                      <UnitPriceRow
                        label="単管足場"
                        unit="円/m²"
                        value={unitPrices.tankan}
                        onChange={(v) => setUnitPrices({ ...unitPrices, tankan: v })}
                      />
                      <UnitPriceRow
                        label="枠組足場"
                        unit="円/m²"
                        value={unitPrices.wakugumi}
                        onChange={(v) => setUnitPrices({ ...unitPrices, wakugumi: v })}
                      />
                      <UnitPriceRow
                        label="吊り足場"
                        unit="円/m²"
                        value={unitPrices.tsuri}
                        onChange={(v) => setUnitPrices({ ...unitPrices, tsuri: v })}
                      />
                      <UnitPriceRow
                        label="メッシュシート"
                        unit="円/m²"
                        value={unitPrices.meshSheet}
                        onChange={(v) =>
                          setUnitPrices({ ...unitPrices, meshSheet: v })
                        }
                      />
                      <UnitPriceRow
                        label="防音シート"
                        unit="円/m²"
                        value={unitPrices.soundSheet}
                        onChange={(v) =>
                          setUnitPrices({ ...unitPrices, soundSheet: v })
                        }
                      />
                      <UnitPriceRow
                        label="昇降階段"
                        unit="円/基"
                        value={unitPrices.stair}
                        onChange={(v) => setUnitPrices({ ...unitPrices, stair: v })}
                      />
                    </tbody>
                  </table>
                  <button
                    type="button"
                    className="est-btn"
                    onClick={() => setUnitPrices(DEFAULT_UNIT_PRICES)}
                    style={{ marginTop: 8, fontSize: "0.8rem" }}
                  >
                    単価リセット
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* 建物リスト */}
          {scale && (
            <section className="panel est-panel">
              <h2 className="est-section-title">建物外周リスト</h2>
              {buildings.length === 0 ? (
                <p style={{ color: "#888" }}>
                  まだ建物が登録されていません。STEP 3 で建物を囲ってください。
                </p>
              ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.95rem",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      <th style={thStyle}>番号</th>
                      <th style={thStyle}>名称</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>
                        周長 (m)
                      </th>
                      <th style={{ ...thStyle, textAlign: "right" }}>
                        床面積 (m²)
                      </th>
                      <th style={thStyle}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildings.map((p, i) => {
                      const perim =
                        scale &&
                        polygonPerimeterPx(p.points, baseWidth, baseHeight) *
                          Math.sqrt(scale);
                      return (
                        <tr
                          key={p.id}
                          style={{
                            background:
                              selectedPolyId === p.id ? "#fff4e6" : "transparent",
                            cursor: "pointer",
                          }}
                          onClick={() => setSelectedPolyId(p.id)}
                        >
                          <td style={tdStyle}>{i + 1}</td>
                          <td style={tdStyle}>
                            <input
                              type="text"
                              value={p.label}
                              onChange={(e) => renamePoly(p.id, e.target.value)}
                              placeholder={`建物${i + 1}`}
                              style={{
                                width: "100%",
                                padding: "3px 6px",
                                fontSize: "0.9rem",
                                border: "1px solid #ddd",
                                borderRadius: 3,
                              }}
                            />
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            {(perim || 0).toFixed(2)}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            {(p.realValue ?? 0).toFixed(2)}
                          </td>
                          <td style={tdStyle}>
                            <button
                              type="button"
                              className="est-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                deletePoly(p.id);
                              }}
                              style={{
                                padding: "2px 10px",
                                fontSize: "0.8rem",
                              }}
                            >
                              削除
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ borderTop: "2px solid #333", fontWeight: 700 }}>
                      <td style={tdStyle}></td>
                      <td style={tdStyle}>合計</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {totalPerimeter.toFixed(2)} m
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {totalFloorArea.toFixed(2)} m²
                      </td>
                      <td style={tdStyle}></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </section>
          )}

          {/* 見積もり結果 */}
          {scale && buildings.length > 0 && (
            <section className="panel est-panel">
              <h2 className="est-section-title">見積もり結果</h2>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.95rem",
                }}
              >
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    <th style={thStyle}>番号</th>
                    <th style={thStyle}>項目</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>数量</th>
                    <th style={thStyle}>単位</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>単価(円)</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>金額(円)</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((r, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>{i + 1}</td>
                      <td style={tdStyle}>{r.name}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {r.qty.toLocaleString()}
                      </td>
                      <td style={tdStyle}>{r.unit}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {r.unitPrice.toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {r.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr
                    style={{
                      borderTop: "2px solid #333",
                      fontWeight: 700,
                      background: "#fffbe6",
                    }}
                  >
                    <td style={tdStyle}></td>
                    <td style={tdStyle}>合計</td>
                    <td style={tdStyle}></td>
                    <td style={tdStyle}></td>
                    <td style={tdStyle}></td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        fontSize: "1.05rem",
                      }}
                    >
                      ¥{totalCost.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="est-btn est-btn--primary"
                  onClick={exportCSV}
                >
                  📥 CSV 出力（足場見積_yyyymmdd.csv）
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// --- 小コンポーネント ---
function FormRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: "0.92rem",
      }}
    >
      <span style={{ minWidth: 80, fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

function Radio({
  name,
  value,
  checked,
  onChange,
  label,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: "0.9rem",
        padding: "2px 0",
      }}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
      />
      {label}
    </label>
  );
}

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        background: color,
        color: "#fff",
        padding: "4px 12px",
        borderRadius: 14,
        fontSize: "0.85rem",
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

function UnitPriceRow({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <tr>
      <td style={tdStyle}>{label}</td>
      <td style={{ ...tdStyle, textAlign: "right" }}>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          style={{
            width: 100,
            padding: "2px 6px",
            fontSize: "0.88rem",
            border: "1px solid #ddd",
            borderRadius: 3,
            textAlign: "right",
          }}
        />
      </td>
      <td style={tdStyle}>{unit}</td>
    </tr>
  );
}

// --- helpers ---
function polygonPixelArea(pts: NPoint[], bw: number, bh: number): number {
  let a = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return (Math.abs(a) / 2) * bw * bh;
}

function polygonPerimeterPx(pts: NPoint[], bw: number, bh: number): number {
  let l = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = (pts[j].x - pts[i].x) * bw;
    const dy = (pts[j].y - pts[i].y) * bh;
    l += Math.sqrt(dx * dx + dy * dy);
  }
  return l;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function scaffoldTypeLabel(t: ScaffoldType): string {
  switch (t) {
    case "ichigawa":
      return "一側足場";
    case "nigawa":
      return "二側足場";
    case "souashiba":
      return "総足場";
    case "tsuri":
      return "吊り足場";
  }
}

function scaffoldKindLabel(t: ScaffoldType, k: ScaffoldKind): string {
  if (t === "tsuri") return "吊り足場";
  const kindLabel =
    k === "kusabi"
      ? "くさび緊結式足場"
      : k === "tankan"
      ? "単管足場"
      : "枠組足場";
  return `${scaffoldTypeLabel(t)}（${kindLabel}）`;
}

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "left",
  borderBottom: "1px solid #ddd",
  fontWeight: 600,
};
const tdStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderBottom: "1px solid #eee",
};
const inputStyle: React.CSSProperties = {
  width: 80,
  padding: "4px 8px",
  fontSize: "0.95rem",
  border: "1px solid #ccc",
  borderRadius: 4,
};
const unitLabelStyle: React.CSSProperties = {
  fontSize: "0.88rem",
  color: "#666",
};
