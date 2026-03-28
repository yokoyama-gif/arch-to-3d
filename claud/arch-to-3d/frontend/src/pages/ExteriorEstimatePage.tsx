import { useCallback, useRef, useState } from "react";
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
import { analyzePdf, exportCsv } from "../api/client";

const CATEGORIES: EstimateCategory[] = ["earthwork", "paving", "fence", "landscaping"];

function formatYen(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(Math.round(value));
}

function generateId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function ExteriorEstimatePage() {
  const [project, setProject] = useState<EstimateProject>({
    name: "",
    clientName: "",
    siteAddress: "",
    items: createDefaultItems(),
    taxRate: 0.10,
  });
  const [activeTab, setActiveTab] = useState<EstimateCategory>("earthwork");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [analysisWarnings, setAnalysisWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeItems = project.items.filter((item) => item.category === activeTab);

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

  // --- PDF Analysis ---
  async function handleAnalyze() {
    if (!pdfFile) {
      setError("PDF図面ファイルを選択してください。");
      return;
    }
    setAnalyzing(true);
    setError(null);
    setAnalysisWarnings([]);
    try {
      const result = await analyzePdf(pdfFile);
      setAnalysisWarnings(result.warnings);

      if (result.items.length > 0) {
        setProject((prev) => {
          // Merge AI items: update existing items by matching name+category, add new ones
          const updatedItems = [...prev.items];
          for (const aiItem of result.items) {
            const existingIndex = updatedItems.findIndex(
              (item) => item.category === aiItem.category && item.name === aiItem.name,
            );
            if (existingIndex >= 0) {
              updatedItems[existingIndex] = {
                ...updatedItems[existingIndex],
                quantity: aiItem.quantity,
                specification: aiItem.specification || updatedItems[existingIndex].specification,
                remarks: aiItem.remarks || updatedItems[existingIndex].remarks,
                aiSuggested: true,
              };
            } else {
              updatedItems.push({ ...aiItem, id: generateId() });
            }
          }
          return { ...prev, items: updatedItems };
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "PDF解析に失敗しました。");
    } finally {
      setAnalyzing(false);
    }
  }

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
            <span>税抜合計</span>
            <strong>¥{formatYen(total)}</strong>
          </div>
          <div className="est-total-card">
            <span>税込合計</span>
            <strong className="est-total-highlight">¥{formatYen(total + tax)}</strong>
          </div>
        </div>
      </header>

      <div className="est-layout">
        {/* Sidebar */}
        <aside className="est-sidebar">
          {/* Project Info */}
          <section className="panel est-panel">
            <h2 className="est-panel-title">工事情報</h2>
            <div className="est-form-grid">
              <label>
                <span>工事名称</span>
                <input
                  type="text"
                  value={project.name}
                  onChange={(e) => updateProjectField("name", e.target.value)}
                  placeholder="例: ○○邸 外構工事"
                />
              </label>
              <label>
                <span>施主名</span>
                <input
                  type="text"
                  value={project.clientName}
                  onChange={(e) => updateProjectField("clientName", e.target.value)}
                  placeholder="例: 山田太郎 様"
                />
              </label>
              <label>
                <span>現場住所</span>
                <input
                  type="text"
                  value={project.siteAddress}
                  onChange={(e) => updateProjectField("siteAddress", e.target.value)}
                  placeholder="例: 京都市○○区..."
                />
              </label>
            </div>
          </section>

          {/* PDF Upload */}
          <section className="panel est-panel">
            <h2 className="est-panel-title">PDF図面解析</h2>
            <div
              className={`est-dropzone ${pdfFile ? "est-dropzone--has-file" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("est-dropzone--hover"); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove("est-dropzone--hover"); }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("est-dropzone--hover");
                const file = e.dataTransfer.files[0];
                if (file?.name.toLowerCase().endsWith(".pdf")) {
                  setPdfFile(file);
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                style={{ display: "none" }}
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
              {pdfFile ? (
                <p className="est-dropzone-label">{pdfFile.name}</p>
              ) : (
                <p className="est-dropzone-label">PDF図面をドラッグ＆ドロップ<br />またはクリックして選択</p>
              )}
            </div>
            <button
              type="button"
              className="primary-button est-full-button"
              onClick={() => void handleAnalyze()}
              disabled={analyzing || !pdfFile}
            >
              {analyzing ? "AI解析中..." : "図面をAI解析"}
            </button>
            {analysisWarnings.length > 0 && (
              <div className="warning-list">
                {analysisWarnings.map((w, i) => <p key={i}>{w}</p>)}
              </div>
            )}
          </section>

          {/* Category Summary */}
          <section className="panel est-panel">
            <h2 className="est-panel-title">カテゴリ別小計</h2>
            <div className="est-summary-list">
              {CATEGORIES.map((cat) => {
                const sub = categorySubtotal(project.items, cat);
                return (
                  <div
                    key={cat}
                    className={`est-summary-row ${activeTab === cat ? "est-summary-row--active" : ""}`}
                    onClick={() => setActiveTab(cat)}
                  >
                    <span className="est-summary-icon">{categoryIcons[cat]}</span>
                    <span className="est-summary-label">{categoryLabels[cat]}</span>
                    <span className="est-summary-amount">¥{formatYen(sub)}</span>
                  </div>
                );
              })}
              <div className="est-summary-divider" />
              <div className="est-summary-row est-summary-row--total">
                <span className="est-summary-label">税抜合計</span>
                <span className="est-summary-amount">¥{formatYen(total)}</span>
              </div>
              <div className="est-summary-row">
                <span className="est-summary-label">消費税（{Math.round(project.taxRate * 100)}%）</span>
                <span className="est-summary-amount">¥{formatYen(tax)}</span>
              </div>
              <div className="est-summary-row est-summary-row--grand">
                <span className="est-summary-label">税込合計</span>
                <span className="est-summary-amount">¥{formatYen(total + tax)}</span>
              </div>
            </div>
          </section>

          {/* Export */}
          <section className="panel est-panel">
            <h2 className="est-panel-title">出力</h2>
            <button
              type="button"
              className="primary-button est-full-button"
              onClick={() => void handleExport()}
              disabled={exporting || itemsWithQuantity.length === 0}
            >
              {exporting ? "出力中..." : "Excel（CSV）ダウンロード"}
            </button>
            <button
              type="button"
              className="ghost-button est-full-button"
              onClick={() => window.print()}
            >
              印刷プレビュー
            </button>
          </section>
        </aside>

        {/* Main Content */}
        <main className="est-main">
          {error && <p className="error-message est-error">{error}</p>}

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
                <span className="est-tab-amount">¥{formatYen(categorySubtotal(project.items, activeTab === cat ? cat : cat))}</span>
              </button>
            ))}
          </div>

          {/* Estimate Table */}
          <div className="panel est-table-panel">
            <div className="est-table-header">
              <h2>{categoryIcons[activeTab]} {categoryLabels[activeTab]}</h2>
              <button
                type="button"
                className="ghost-button"
                onClick={() => addItem(activeTab)}
              >
                ＋ 行を追加
              </button>
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
                    <tr key={item.id} className={item.aiSuggested ? "est-row--ai" : ""}>
                      <td>
                        <input
                          type="text"
                          className="est-cell-input est-cell-name"
                          value={item.name}
                          onChange={(e) => updateItem(item.id, "name", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="est-cell-input est-cell-spec"
                          value={item.specification}
                          onChange={(e) => updateItem(item.id, "specification", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="est-cell-input est-cell-num"
                          min={0}
                          step="0.1"
                          value={item.quantity || ""}
                          onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="est-cell-input est-cell-unit"
                          value={item.unit}
                          onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="est-cell-input est-cell-num"
                          min={0}
                          step="100"
                          value={item.unitPrice || ""}
                          onChange={(e) => updateItem(item.id, "unitPrice", Number(e.target.value))}
                        />
                      </td>
                      <td className="est-cell-amount">
                        ¥{formatYen(itemAmount(item))}
                      </td>
                      <td>
                        <input
                          type="text"
                          className="est-cell-input est-cell-remarks"
                          value={item.remarks}
                          onChange={(e) => updateItem(item.id, "remarks", e.target.value)}
                          placeholder={item.aiSuggested ? "AI推定" : ""}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="est-delete-btn"
                          onClick={() => removeItem(item.id)}
                          title="この行を削除"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                  {activeItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className="est-empty-row">
                        この分類に項目がありません。「＋ 行を追加」で追加してください。
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="est-subtotal-row">
                    <td colSpan={5} className="est-subtotal-label">
                      {categoryLabels[activeTab]} 小計
                    </td>
                    <td className="est-subtotal-amount">
                      ¥{formatYen(categorySubtotal(project.items, activeTab))}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Summary Table (print + overview) */}
          <div className="panel est-table-panel est-overview-panel">
            <h2>積算一覧（数量入力済のみ）</h2>
            {itemsWithQuantity.length === 0 ? (
              <p className="empty-state">数量が入力されている項目がありません。</p>
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
                          {idx === 0 && (
                            <td rowSpan={catItems.length} className="est-cat-cell">
                              {categoryIcons[cat]} {categoryLabels[cat]}
                            </td>
                          )}
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
        </main>
      </div>
    </div>
  );
}
