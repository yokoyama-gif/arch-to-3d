import { useCallback, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  type EstimateCategory,
  type EstimateItem,
  type EstimateProject,
  categoryIcons,
  categoryLabels,
  categorySubtotal,
  createDefaultItems,
  grandTotal,
  itemAmount,
} from "../types/estimate";
import { exportCsv } from "../api/client";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const CATEGORIES: EstimateCategory[] = ["earthwork", "paving", "fence", "landscaping"];

function formatYen(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(Math.round(value));
}

function generateId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// Step definitions
type Step = "upload" | "site" | "estimate";

export default function ExteriorEstimatePage() {
  const [project, setProject] = useState<EstimateProject>({
    name: "",
    clientName: "",
    siteAddress: "",
    items: createDefaultItems(),
    taxRate: 0.10,
  });
  const [step, setStep] = useState<Step>("upload");
  const [activeTab, setActiveTab] = useState<EstimateCategory>("earthwork");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.0);

  // Site info
  const [siteArea, setSiteArea] = useState<number>(0);
  const [buildingArea, setBuildingArea] = useState<number>(0);
  const [frontRoad, setFrontRoad] = useState("");
  const [siteShape, setSiteShape] = useState("rectangular");

  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeItems = project.items.filter((item) => item.category === activeTab);
  const exteriorArea = siteArea > 0 && buildingArea > 0 ? siteArea - buildingArea : 0;

  // --- PDF handling ---
  function handlePdfSelect(file: File | null) {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    if (file) {
      setPdfFile(file);
      setPdfUrl(URL.createObjectURL(file));
      setCurrentPage(1);
      setStep("site");
    } else {
      setPdfFile(null);
      setPdfUrl(null);
      setNumPages(0);
    }
  }

  function onDocumentLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n);
    setCurrentPage(1);
  }

  // --- Mutations ---
  const updateProjectField = useCallback(
    (field: keyof Pick<EstimateProject, "name" | "clientName" | "siteAddress">, value: string) => {
      setProject((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const updateItem = useCallback(
    (id: string, field: keyof EstimateItem, value: string | number | boolean) => {
      setProject((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === id ? { ...item, [field]: value } : item,
        ),
      }));
    },
    [],
  );

  const addItem = useCallback(
    (category: EstimateCategory) => {
      const newItem: EstimateItem = {
        id: generateId(),
        category,
        name: "",
        specification: "",
        quantity: 0,
        unit: "m2",
        unitPrice: 0,
        remarks: "",
        aiSuggested: false,
      };
      setProject((prev) => ({ ...prev, items: [...prev.items, newItem] }));
    },
    [],
  );

  const removeItem = useCallback((id: string) => {
    setProject((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  }, []);

  // --- CSV Export ---
  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const blob = await exportCsv(project);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `外構積算_${project.name || "export"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "CSV出力に失敗しました。");
    } finally {
      setExporting(false);
    }
  }

  // --- Computed ---
  const total = grandTotal(project.items);
  const tax = Math.round(total * project.taxRate);
  const itemsWithQuantity = project.items.filter((i) => i.quantity > 0);

  return (
    <div className="est-shell">
      {/* Header */}
      <header className="est-header">
        <div className="est-header-left">
          <p className="eyebrow">Exterior Estimate</p>
          <h1 className="est-title">外構費用積算システム</h1>
        </div>
        <div className="est-header-right">
          <div className="est-total-card">
            <span>外構対象面積</span>
            <strong>{exteriorArea > 0 ? `${exteriorArea.toFixed(1)} m2` : "—"}</strong>
          </div>
          <div className="est-total-card">
            <span>税抜合計</span>
            <strong>¥{formatYen(total)}</strong>
          </div>
          <div className="est-total-card">
            <span>税込合計</span>
            <strong className="est-total-highlight">¥{formatYen(total + tax)}</strong>
          </div>
        </div>
      </header>

      {/* Step indicator */}
      <div className="est-steps">
        <button type="button" className={`est-step ${step === "upload" ? "est-step--active" : ""} ${pdfFile ? "est-step--done" : ""}`} onClick={() => setStep("upload")}>
          <span className="est-step-num">1</span>
          <span className="est-step-text">図面取込</span>
        </button>
        <div className="est-step-arrow">▶</div>
        <button type="button" className={`est-step ${step === "site" ? "est-step--active" : ""} ${siteArea > 0 ? "est-step--done" : ""}`} onClick={() => pdfFile && setStep("site")} disabled={!pdfFile}>
          <span className="est-step-num">2</span>
          <span className="est-step-text">敷地情報</span>
        </button>
        <div className="est-step-arrow">▶</div>
        <button type="button" className={`est-step ${step === "estimate" ? "est-step--active" : ""} ${itemsWithQuantity.length > 0 ? "est-step--done" : ""}`} onClick={() => setStep("estimate")} disabled={!pdfFile}>
          <span className="est-step-num">3</span>
          <span className="est-step-text">面積拾い・積算</span>
        </button>
      </div>

      {error && <p className="error-message est-error">{error}</p>}

      {/* Step 1: PDF Upload */}
      {step === "upload" && (
        <div className="est-step-content">
          <section className="panel est-panel est-upload-section">
            <h2 className="est-section-title">STEP 1：外構図面を取り込む</h2>
            <p className="est-section-desc">PDF形式の外構図面をアップロードしてください。図面を見ながら面積を拾っていきます。</p>
            <div
              className="est-dropzone est-dropzone-large"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("est-dropzone--hover"); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove("est-dropzone--hover"); }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("est-dropzone--hover");
                const file = e.dataTransfer.files[0];
                if (file?.name.toLowerCase().endsWith(".pdf")) handlePdfSelect(file);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                style={{ display: "none" }}
                onChange={(e) => handlePdfSelect(e.target.files?.[0] ?? null)}
              />
              <div className="est-dropzone-icon">📄</div>
              <p className="est-dropzone-label">
                PDF外構図面をドラッグ＆ドロップ<br />またはクリックして選択
              </p>
            </div>
            {pdfFile && (
              <div className="est-file-info">
                <span>選択中: {pdfFile.name}</span>
                <button type="button" className="primary-button" onClick={() => setStep("site")}>次へ：敷地情報を入力 ▶</button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Step 2: Site Info */}
      {step === "site" && (
        <div className="est-step-content">
          <div className="est-site-layout">
            {/* PDF preview (small) */}
            <div className="panel est-panel est-site-pdf">
              <h2 className="est-panel-title">図面プレビュー</h2>
              {pdfUrl && (
                <div className="est-pdf-mini-scroll">
                  <Document file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess} loading={<p style={{ padding: 20, color: "#6c6257" }}>読み込み中...</p>}>
                    <Page pageNumber={currentPage} width={500} renderTextLayer={false} renderAnnotationLayer={false} />
                  </Document>
                </div>
              )}
              {numPages > 1 && (
                <div className="est-pdf-controls">
                  <button type="button" className="est-pdf-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>◀</button>
                  <span className="est-pdf-pageinfo">{currentPage} / {numPages}</span>
                  <button type="button" className="est-pdf-btn" disabled={currentPage >= numPages} onClick={() => setCurrentPage((p) => p + 1)}>▶</button>
                </div>
              )}
            </div>

            {/* Site info form */}
            <div className="panel est-panel est-site-form">
              <h2 className="est-section-title">STEP 2：敷地情報を入力</h2>
              <p className="est-section-desc">図面を確認しながら、敷地の情報を入力してください。</p>

              <div className="est-form-blocks">
                <div className="est-form-block">
                  <h3>工事情報</h3>
                  <div className="est-form-row">
                    <label>
                      <span>工事名称</span>
                      <input type="text" value={project.name} onChange={(e) => updateProjectField("name", e.target.value)} placeholder="例: ○○邸 外構工事" />
                    </label>
                    <label>
                      <span>施主名</span>
                      <input type="text" value={project.clientName} onChange={(e) => updateProjectField("clientName", e.target.value)} placeholder="例: 山田太郎 様" />
                    </label>
                  </div>
                  <label>
                    <span>現場住所</span>
                    <input type="text" value={project.siteAddress} onChange={(e) => updateProjectField("siteAddress", e.target.value)} placeholder="例: 京都市○○区..." />
                  </label>
                </div>

                <div className="est-form-block">
                  <h3>敷地面積</h3>
                  <div className="est-form-row">
                    <label>
                      <span>敷地面積（m2）</span>
                      <input type="number" min={0} step="0.1" value={siteArea || ""} onChange={(e) => setSiteArea(Number(e.target.value))} placeholder="例: 200" className="est-big-input" />
                    </label>
                    <label>
                      <span>建物面積（m2）</span>
                      <input type="number" min={0} step="0.1" value={buildingArea || ""} onChange={(e) => setBuildingArea(Number(e.target.value))} placeholder="例: 80" className="est-big-input" />
                    </label>
                  </div>

                  {exteriorArea > 0 && (
                    <div className="est-area-result">
                      <div className="est-area-result-item">
                        <span>敷地面積</span>
                        <strong>{siteArea.toFixed(1)} m2</strong>
                      </div>
                      <div className="est-area-result-sep">−</div>
                      <div className="est-area-result-item">
                        <span>建物面積</span>
                        <strong>{buildingArea.toFixed(1)} m2</strong>
                      </div>
                      <div className="est-area-result-sep">＝</div>
                      <div className="est-area-result-item est-area-result-main">
                        <span>外構対象面積</span>
                        <strong>{exteriorArea.toFixed(1)} m2</strong>
                      </div>
                    </div>
                  )}
                </div>

                <div className="est-form-block">
                  <h3>敷地条件（任意）</h3>
                  <div className="est-form-row">
                    <label>
                      <span>前面道路</span>
                      <input type="text" value={frontRoad} onChange={(e) => setFrontRoad(e.target.value)} placeholder="例: 南側6m公道" />
                    </label>
                    <label>
                      <span>敷地形状</span>
                      <select value={siteShape} onChange={(e) => setSiteShape(e.target.value)}>
                        <option value="rectangular">整形地</option>
                        <option value="irregular">不整形地</option>
                        <option value="flag">旗竿地</option>
                        <option value="slope">傾斜地</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <div className="est-step-actions">
                <button type="button" className="ghost-button" onClick={() => setStep("upload")}>◀ 戻る</button>
                <button type="button" className="primary-button" onClick={() => setStep("estimate")} disabled={siteArea <= 0}>
                  次へ：面積拾い・積算 ▶
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Estimate */}
      {step === "estimate" && (
        <div className="est-layout-v2">
          {/* Left: PDF Viewer */}
          <div className="est-pdf-column">
            <section className="panel est-panel est-pdf-panel">
              <div className="est-pdf-toolbar">
                <h2 className="est-panel-title" style={{ margin: 0 }}>図面</h2>
                <div className="est-pdf-actions">
                  <button type="button" className="ghost-button" onClick={() => fileInputRef.current?.click()}>図面変更</button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    style={{ display: "none" }}
                    onChange={(e) => handlePdfSelect(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              {pdfUrl && (
                <div className="est-pdf-viewer">
                  <div className="est-pdf-controls">
                    <button type="button" className="est-pdf-btn" onClick={() => setPdfScale((s) => Math.max(0.3, s - 0.15))}>−</button>
                    <span className="est-pdf-zoom">{Math.round(pdfScale * 100)}%</span>
                    <button type="button" className="est-pdf-btn" onClick={() => setPdfScale((s) => Math.min(3, s + 0.15))}>＋</button>
                    <span className="est-pdf-sep">|</span>
                    <button type="button" className="est-pdf-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>◀</button>
                    <span className="est-pdf-pageinfo">{currentPage} / {numPages}</span>
                    <button type="button" className="est-pdf-btn" disabled={currentPage >= numPages} onClick={() => setCurrentPage((p) => p + 1)}>▶</button>
                    <button type="button" className="est-pdf-btn" onClick={() => setPdfScale(1.0)} style={{ width: "auto", padding: "0 8px", fontSize: "0.78rem" }}>リセット</button>
                  </div>
                  <div className="est-pdf-scroll">
                    <Document file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess} loading={<p style={{ padding: 20, color: "#6c6257" }}>読み込み中...</p>}>
                      <Page pageNumber={currentPage} scale={pdfScale} renderTextLayer={false} renderAnnotationLayer={false} />
                    </Document>
                  </div>
                </div>
              )}
              {/* Site summary below PDF */}
              {exteriorArea > 0 && (
                <div className="est-pdf-site-summary">
                  <span>敷地 {siteArea}m2</span>
                  <span>建物 {buildingArea}m2</span>
                  <strong>外構 {exteriorArea.toFixed(1)}m2</strong>
                  <button type="button" className="est-edit-site-btn" onClick={() => setStep("site")}>編集</button>
                </div>
              )}
            </section>
          </div>

          {/* Right: Estimate Input */}
          <div className="est-input-column">
            {/* Category Tabs */}
            <div className="est-tabs">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`est-tab ${activeTab === cat ? "est-tab--active" : ""}`}
                  onClick={() => setActiveTab(cat)}
                >
                  <span className="est-tab-icon">{categoryIcons[cat]}</span>
                  <span className="est-tab-label">{categoryLabels[cat]}</span>
                  <span className="est-tab-amount">¥{formatYen(categorySubtotal(project.items, cat))}</span>
                </button>
              ))}
            </div>

            {/* Estimate Table */}
            <div className="panel est-table-panel">
              <div className="est-table-header">
                <h2>{categoryIcons[activeTab]} {categoryLabels[activeTab]}</h2>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {exteriorArea > 0 && <span className="est-area-hint">外構面積: {exteriorArea.toFixed(1)}m2</span>}
                  <button type="button" className="ghost-button" onClick={() => addItem(activeTab)}>＋ 行を追加</button>
                </div>
              </div>

              <div className="est-table-wrap">
                <table className="est-table">
                  <thead>
                    <tr>
                      <th className="est-th-name">項目名</th>
                      <th className="est-th-spec">規格・仕様</th>
                      <th className="est-th-qty">数量</th>
                      <th className="est-th-unit">単位</th>
                      <th className="est-th-price">単価（円）</th>
                      <th className="est-th-amount">金額（円）</th>
                      <th className="est-th-remarks">備考</th>
                      <th className="est-th-action"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeItems.map((item) => (
                      <tr key={item.id}>
                        <td><input type="text" className="est-cell-input est-cell-name" value={item.name} onChange={(e) => updateItem(item.id, "name", e.target.value)} /></td>
                        <td><input type="text" className="est-cell-input est-cell-spec" value={item.specification} onChange={(e) => updateItem(item.id, "specification", e.target.value)} /></td>
                        <td><input type="number" className="est-cell-input est-cell-num" min={0} step="0.1" value={item.quantity || ""} onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))} /></td>
                        <td><input type="text" className="est-cell-input est-cell-unit" value={item.unit} onChange={(e) => updateItem(item.id, "unit", e.target.value)} /></td>
                        <td><input type="number" className="est-cell-input est-cell-num" min={0} step="100" value={item.unitPrice || ""} onChange={(e) => updateItem(item.id, "unitPrice", Number(e.target.value))} /></td>
                        <td className="est-cell-amount">¥{formatYen(itemAmount(item))}</td>
                        <td><input type="text" className="est-cell-input est-cell-remarks" value={item.remarks} onChange={(e) => updateItem(item.id, "remarks", e.target.value)} /></td>
                        <td><button type="button" className="est-delete-btn" onClick={() => removeItem(item.id)} title="この行を削除">×</button></td>
                      </tr>
                    ))}
                    {activeItems.length === 0 && (
                      <tr><td colSpan={8} className="est-empty-row">「＋ 行を追加」で項目を追加してください。</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="est-subtotal-row">
                      <td colSpan={5} className="est-subtotal-label">{categoryLabels[activeTab]} 小計</td>
                      <td className="est-subtotal-amount">¥{formatYen(categorySubtotal(project.items, activeTab))}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Summary + Export */}
            <div className="panel est-table-panel est-overview-panel">
              <div className="est-table-header">
                <h2>積算一覧</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="primary-button" onClick={() => void handleExport()} disabled={exporting || itemsWithQuantity.length === 0}>
                    {exporting ? "出力中..." : "Excel（CSV）ダウンロード"}
                  </button>
                  <button type="button" className="ghost-button" onClick={() => window.print()}>印刷</button>
                </div>
              </div>
              {itemsWithQuantity.length === 0 ? (
                <p className="empty-state">図面を見ながら、各カテゴリの数量を入力してください。</p>
              ) : (
                <div className="est-table-wrap">
                  <table className="est-table est-table--overview">
                    <thead>
                      <tr>
                        <th>カテゴリ</th>
                        <th>項目名</th>
                        <th>規格・仕様</th>
                        <th className="est-th-qty">数量</th>
                        <th className="est-th-unit">単位</th>
                        <th className="est-th-price">単価</th>
                        <th className="est-th-amount">金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CATEGORIES.map((cat) => {
                        const catItems = itemsWithQuantity.filter((i) => i.category === cat);
                        if (catItems.length === 0) return null;
                        return catItems.map((item, idx) => (
                          <tr key={item.id} className={idx === 0 ? "est-cat-first" : ""}>
                            {idx === 0 && <td rowSpan={catItems.length} className="est-cat-cell">{categoryIcons[cat]} {categoryLabels[cat]}</td>}
                            <td>{item.name}</td>
                            <td>{item.specification}</td>
                            <td className="est-cell-num-display">{item.quantity}</td>
                            <td>{item.unit}</td>
                            <td className="est-cell-num-display">¥{formatYen(item.unitPrice)}</td>
                            <td className="est-cell-num-display">¥{formatYen(itemAmount(item))}</td>
                          </tr>
                        ));
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="est-subtotal-row">
                        <td colSpan={6} className="est-subtotal-label">税抜合計</td>
                        <td className="est-subtotal-amount">¥{formatYen(total)}</td>
                      </tr>
                      <tr>
                        <td colSpan={6} className="est-subtotal-label">消費税（{Math.round(project.taxRate * 100)}%）</td>
                        <td className="est-subtotal-amount">¥{formatYen(tax)}</td>
                      </tr>
                      <tr className="est-grand-row">
                        <td colSpan={6} className="est-subtotal-label">税込合計</td>
                        <td className="est-subtotal-amount">¥{formatYen(total + tax)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
