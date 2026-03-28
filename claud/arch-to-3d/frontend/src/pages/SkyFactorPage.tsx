import { useEffect, useRef, useState } from "react";
import { analyzeSkyFactor, importDrawing } from "../api/client";
import type {
  BoundaryKey,
  BoundaryRule,
  BoundaryRuleSet,
  DrawingImportResponse,
  DrawingUnit,
  EvaluationSettings,
  ObservationPoint,
  RuleType,
  SiteInput,
  SkyFactorRequest,
  SkyFactorResponse,
  VolumeInput,
  VolumeKind,
} from "../types/skyfactor";

const boundaryLabels: Record<BoundaryKey, string> = {
  south: "南側",
  east: "東側",
  north: "北側",
  west: "西側",
};

const ruleLabels: Record<RuleType, string> = {
  fixed: "固定閾値",
  road: "道路斜線",
  adjacent: "隣地斜線",
};

const kindLabels: Record<VolumeKind, string> = {
  planned: "計画建物",
  context: "周辺建物",
};

const qualityPresets = {
  standard: {
    azimuth: 144,
    altitude: 24,
  },
  dense: {
    azimuth: 240,
    altitude: 36,
  },
};

const initialBoundaryRules: BoundaryRuleSet = {
  south: {
    enabled: true,
    rule_type: "road",
    fixed_threshold: 35,
    road_width: 6,
    setback: 0,
    slope: 1.25,
    base_height: 0,
  },
  east: {
    enabled: true,
    rule_type: "adjacent",
    fixed_threshold: 35,
    road_width: 4,
    setback: 0,
    slope: 1.25,
    base_height: 20,
  },
  north: {
    enabled: true,
    rule_type: "adjacent",
    fixed_threshold: 35,
    road_width: 4,
    setback: 0,
    slope: 1.25,
    base_height: 20,
  },
  west: {
    enabled: true,
    rule_type: "adjacent",
    fixed_threshold: 35,
    road_width: 4,
    setback: 0,
    slope: 1.25,
    base_height: 20,
  },
};

const initialRequest: SkyFactorRequest = {
  site: { width: 22, depth: 18 },
  boundary_rules: initialBoundaryRules,
  settings: {
    measurement_height: 1.5,
    point_spacing: 2,
    boundary_offset: 0.1,
    sample_azimuth_divisions: qualityPresets.standard.azimuth,
    sample_altitude_divisions: qualityPresets.standard.altitude,
  },
  volumes: [
    {
      id: "planned-1",
      name: "共同住宅案",
      x: 5,
      y: 3.2,
      width: 10.4,
      depth: 7.2,
      height: 13.5,
      kind: "planned",
    },
    {
      id: "context-1",
      name: "北側既存棟 H=9",
      x: 4,
      y: 20,
      width: 9,
      depth: 5,
      height: 9,
      kind: "context",
    },
  ],
};

function formatNumber(value: number) {
  return value.toFixed(2);
}

function colorForPoint(point: ObservationPoint | undefined) {
  if (!point) {
    return "#d6d1c4";
  }
  if (point.margin_percent >= 5) {
    return "#3f7f5f";
  }
  if (point.margin_percent >= 0) {
    return "#d88b2c";
  }
  return "#bf4b39";
}

function createVolume(kind: VolumeKind): VolumeInput {
  const id = `${kind}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    name: kind === "planned" ? "新規ボリューム" : "周辺ボリューム",
    x: kind === "planned" ? 4 : -4,
    y: kind === "planned" ? 4 : 20,
    width: 6,
    depth: 6,
    height: kind === "planned" ? 12 : 8,
    kind,
  };
}

function downloadJsonReport(result: SkyFactorResponse) {
  const blob = new Blob([JSON.stringify(result, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "skyfactor-report.json";
  link.click();
  URL.revokeObjectURL(url);
}

function getQualityKey(settings: EvaluationSettings) {
  for (const [key, preset] of Object.entries(qualityPresets)) {
    if (
      preset.azimuth === settings.sample_azimuth_divisions &&
      preset.altitude === settings.sample_altitude_divisions
    ) {
      return key;
    }
  }
  return "custom";
}

function PlanPreview({
  site,
  volumes,
  points,
}: {
  site: SiteInput;
  volumes: VolumeInput[];
  points: ObservationPoint[];
}) {
  const minX =
    Math.min(
      0,
      ...volumes.map((volume) => volume.x),
      ...points.map((point) => point.position.x)
    ) - 2;
  const minY =
    Math.min(
      0,
      ...volumes.map((volume) => volume.y),
      ...points.map((point) => point.position.y)
    ) - 2;
  const maxX =
    Math.max(
      site.width,
      ...volumes.map((volume) => volume.x + volume.width),
      ...points.map((point) => point.position.x)
    ) + 2;
  const maxY =
    Math.max(
      site.depth,
      ...volumes.map((volume) => volume.y + volume.depth),
      ...points.map((point) => point.position.y)
    ) + 2;
  const width = maxX - minX;
  const height = maxY - minY;

  return (
    <div className="panel plan-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Plan</p>
          <h2>配置プレビュー</h2>
        </div>
        <p className="panel-note">マージン色分けで測点を表示</p>
      </div>
      <svg
        className="plan-svg"
        viewBox={`${minX} ${-maxY} ${width} ${height}`}
        role="img"
        aria-label="配置プレビュー"
      >
        <defs>
          <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#d8d1c6" strokeWidth="0.03" />
          </pattern>
        </defs>
        <rect x={minX} y={-maxY} width={width} height={height} fill="url(#grid)" />
        <rect
          x={0}
          y={-site.depth}
          width={site.width}
          height={site.depth}
          fill="#f3ead7"
          stroke="#473d2b"
          strokeWidth="0.18"
          rx="0.4"
        />
        {volumes.map((volume) => (
          <g key={volume.id}>
            <rect
              x={volume.x}
              y={-(volume.y + volume.depth)}
              width={volume.width}
              height={volume.depth}
              fill={volume.kind === "planned" ? "#d46f4d" : "#5a7c87"}
              fillOpacity={0.86}
              stroke="#1e1b18"
              strokeWidth="0.12"
              rx="0.2"
            />
            <text
              x={volume.x + volume.width / 2}
              y={-(volume.y + volume.depth / 2)}
              textAnchor="middle"
              dominantBaseline="middle"
              className="plan-label"
            >
              {volume.name}
            </text>
          </g>
        ))}
        {points.map((point) => (
          <circle
            key={point.id}
            cx={point.position.x}
            cy={-point.position.y}
            r="0.22"
            fill={colorForPoint(point)}
            stroke="#fcfaf6"
            strokeWidth="0.08"
          />
        ))}
      </svg>
      <div className="legend">
        <span>
          <i className="legend-swatch planned" />
          計画建物
        </span>
        <span>
          <i className="legend-swatch context" />
          周辺建物
        </span>
        <span>
          <i className="legend-swatch pass" />
          余裕あり
        </span>
        <span>
          <i className="legend-swatch warning" />
          適合境界
        </span>
        <span>
          <i className="legend-swatch fail" />
          不適合
        </span>
      </div>
    </div>
  );
}

function RuleCard({
  boundary,
  rule,
  onChange,
}: {
  boundary: BoundaryKey;
  rule: BoundaryRule;
  onChange: (field: keyof BoundaryRule, value: boolean | number | RuleType) => void;
}) {
  return (
    <article className="rule-card">
      <div className="volume-card-header">
        <div>
          <p className="volume-kind">Boundary Rule</p>
          <h4>{boundaryLabels[boundary]}</h4>
        </div>
        <label className="toggle-chip compact-toggle">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={(event) => onChange("enabled", event.target.checked)}
          />
          <span>{rule.enabled ? "有効" : "無効"}</span>
        </label>
      </div>

      <div className="field-grid two-column compact-grid">
        <label>
          <span>判定方式</span>
          <select
            value={rule.rule_type}
            onChange={(event) =>
              onChange("rule_type", event.target.value as RuleType)
            }
          >
            <option value="fixed">固定閾値</option>
            <option value="road">道路斜線</option>
            <option value="adjacent">隣地斜線</option>
          </select>
        </label>
        <label>
          <span>固定閾値</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={rule.fixed_threshold}
            onChange={(event) =>
              onChange("fixed_threshold", Number(event.target.value))
            }
          />
        </label>
        {rule.rule_type === "road" ? (
          <label>
            <span>道路幅員</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={rule.road_width}
              onChange={(event) =>
                onChange("road_width", Number(event.target.value))
              }
            />
          </label>
        ) : null}
        {rule.rule_type !== "fixed" ? (
          <>
            <label>
              <span>後退距離</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={rule.setback}
                onChange={(event) => onChange("setback", Number(event.target.value))}
              />
            </label>
            <label>
              <span>斜線勾配</span>
              <input
                type="number"
                min={0.1}
                step={0.05}
                value={rule.slope}
                onChange={(event) => onChange("slope", Number(event.target.value))}
              />
            </label>
            <label>
              <span>立上り高さ</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={rule.base_height}
                onChange={(event) =>
                  onChange("base_height", Number(event.target.value))
                }
              />
            </label>
          </>
        ) : null}
      </div>
      <p className="micro-copy">{ruleLabels[rule.rule_type]}を基準天空率に使用します。</p>
    </article>
  );
}

export default function SkyFactorPage() {
  const [request, setRequest] = useState<SkyFactorRequest>(initialRequest);
  const [result, setResult] = useState<SkyFactorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [drawingFile, setDrawingFile] = useState<File | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importOptions, setImportOptions] = useState({
    unit: "mm" as DrawingUnit,
    default_planned_height: 12,
    default_context_height: 9,
  });
  const initialRun = useRef(false);

  async function runAnalysis(nextRequest: SkyFactorRequest = request) {
    setLoading(true);
    setError(null);
    try {
      const nextResult = await analyzeSkyFactor(nextRequest);
      setResult(nextResult);
    } catch (analysisError: unknown) {
      if (
        typeof analysisError === "object" &&
        analysisError !== null &&
        "message" in analysisError
      ) {
        setError(String(analysisError.message));
      } else {
        setError("解析に失敗しました。入力条件を確認してください。");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!drawingFile) {
      setError("取り込む DXF/JWW/JWC ファイルを選択してください。");
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const imported = await importDrawing(drawingFile, importOptions);
      applyImportedDrawing(imported);
    } catch (importError: unknown) {
      if (
        typeof importError === "object" &&
        importError !== null &&
        "message" in importError
      ) {
        setError(String(importError.message));
      } else {
        setError("図面の取り込みに失敗しました。");
      }
    } finally {
      setImporting(false);
    }
  }

  function applyImportedDrawing(imported: DrawingImportResponse) {
    const nextRequest: SkyFactorRequest = {
      ...request,
      site: imported.site,
      volumes: imported.volumes,
    };
    setRequest(nextRequest);
    setImportWarnings(imported.warnings);
    void runAnalysis(nextRequest);
  }

  useEffect(() => {
    if (initialRun.current) {
      return;
    }
    initialRun.current = true;
    void runAnalysis(initialRequest);
  }, []);

  function updateSite(field: keyof SiteInput, value: number) {
    setRequest((current) => ({
      ...current,
      site: { ...current.site, [field]: value },
    }));
  }

  function updateSettings(field: keyof EvaluationSettings, value: number) {
    setRequest((current) => ({
      ...current,
      settings: { ...current.settings, [field]: value },
    }));
  }

  function updateBoundaryRule(
    boundary: BoundaryKey,
    field: keyof BoundaryRule,
    value: boolean | number | RuleType
  ) {
    setRequest((current) => ({
      ...current,
      boundary_rules: {
        ...current.boundary_rules,
        [boundary]: {
          ...current.boundary_rules[boundary],
          [field]: value,
        },
      },
    }));
  }

  function updateVolume(
    volumeId: string,
    field: keyof VolumeInput,
    value: string | number
  ) {
    setRequest((current) => ({
      ...current,
      volumes: current.volumes.map((volume) =>
        volume.id === volumeId ? { ...volume, [field]: value } : volume
      ),
    }));
  }

  function addVolume(kind: VolumeKind) {
    setRequest((current) => ({
      ...current,
      volumes: [...current.volumes, createVolume(kind)],
    }));
  }

  function removeVolume(volumeId: string) {
    setRequest((current) => ({
      ...current,
      volumes: current.volumes.filter((volume) => volume.id !== volumeId),
    }));
  }

  function applyQualityPreset(presetKey: string) {
    if (presetKey === "custom") {
      return;
    }
    const preset = qualityPresets[presetKey as keyof typeof qualityPresets];
    updateSettings("sample_azimuth_divisions", preset.azimuth);
    updateSettings("sample_altitude_divisions", preset.altitude);
  }

  function resetAll() {
    setRequest(initialRequest);
    setImportWarnings([]);
    setDrawingFile(null);
    void runAnalysis(initialRequest);
  }

  const worstPoints =
    result?.observation_points
      .slice()
      .sort((left, right) => left.margin_percent - right.margin_percent)
      .slice(0, 8) ?? [];

  return (
    <div className="app-shell">
      <div className="hero">
        <div>
          <p className="eyebrow">Sky Factor Study Tool</p>
          <h1>建築の天空率検討システム</h1>
          <p className="hero-copy">
            DXF 取込と、道路斜線・隣地斜線を使った基準天空率比較まで含む初期検討版です。
            JWW/JWC は変換コマンドを設定した環境で取り込みできます。
          </p>
        </div>
        <div className="hero-stats">
          <div className="stat-card">
            <span>最低天空率</span>
            <strong>
              {result ? `${formatNumber(result.summary.minimum_percent)}%` : "--"}
            </strong>
          </div>
          <div className="stat-card">
            <span>最低基準値</span>
            <strong>
              {result
                ? `${formatNumber(result.summary.minimum_reference_percent)}%`
                : "--"}
            </strong>
          </div>
          <div className="stat-card">
            <span>最小マージン</span>
            <strong>
              {result
                ? `${formatNumber(result.summary.minimum_margin_percent)}%`
                : "--"}
            </strong>
          </div>
        </div>
      </div>

      <div className="workspace-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Inputs</p>
              <h2>解析条件</h2>
            </div>
            <p className="panel-note">単位は高さ・距離とも m</p>
          </div>

          <div className="section-block import-box">
            <div className="section-headline">
              <h3>図面取込</h3>
              <p>DXF / JWW / JWC</p>
            </div>
            <div className="field-grid two-column compact-grid">
              <label>
                <span>図面ファイル</span>
                <input
                  type="file"
                  accept=".dxf,.jww,.jwc"
                  onChange={(event) =>
                    setDrawingFile(event.target.files?.[0] ?? null)
                  }
                />
              </label>
              <label>
                <span>座標単位</span>
                <select
                  value={importOptions.unit}
                  onChange={(event) =>
                    setImportOptions((current) => ({
                      ...current,
                      unit: event.target.value as DrawingUnit,
                    }))
                  }
                >
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                  <option value="m">m</option>
                </select>
              </label>
              <label>
                <span>計画棟既定高さ</span>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={importOptions.default_planned_height}
                  onChange={(event) =>
                    setImportOptions((current) => ({
                      ...current,
                      default_planned_height: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                <span>周辺棟既定高さ</span>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={importOptions.default_context_height}
                  onChange={(event) =>
                    setImportOptions((current) => ({
                      ...current,
                      default_context_height: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>
            <div className="inline-actions import-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleImport()}
                disabled={importing}
              >
                {importing ? "取込中..." : "図面を取り込む"}
              </button>
            </div>
            {importWarnings.length > 0 ? (
              <div className="warning-list">
                {importWarnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}
          </div>

          <div className="section-block">
            <h3>敷地</h3>
            <div className="field-grid two-column compact-grid">
              <label>
                <span>敷地幅</span>
                <input
                  type="number"
                  min={1}
                  step={0.1}
                  value={request.site.width}
                  onChange={(event) => updateSite("width", Number(event.target.value))}
                />
              </label>
              <label>
                <span>敷地奥行</span>
                <input
                  type="number"
                  min={1}
                  step={0.1}
                  value={request.site.depth}
                  onChange={(event) => updateSite("depth", Number(event.target.value))}
                />
              </label>
            </div>
          </div>

          <div className="section-block">
            <div className="section-headline">
              <h3>建物ボリューム</h3>
              <div className="inline-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => addVolume("planned")}
                >
                  計画棟を追加
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => addVolume("context")}
                >
                  周辺棟を追加
                </button>
              </div>
            </div>
            <div className="volume-list">
              {request.volumes.map((volume) => (
                <article key={volume.id} className="volume-card">
                  <div className="volume-card-header">
                    <div>
                      <p className="volume-kind">{kindLabels[volume.kind]}</p>
                      <input
                        className="volume-name"
                        value={volume.name}
                        onChange={(event) =>
                          updateVolume(volume.id, "name", event.target.value)
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => removeVolume(volume.id)}
                      disabled={request.volumes.length === 1}
                    >
                      削除
                    </button>
                  </div>
                  <div className="field-grid triple-column compact-grid">
                    <label>
                      <span>X</span>
                      <input
                        type="number"
                        step={0.1}
                        value={volume.x}
                        onChange={(event) =>
                          updateVolume(volume.id, "x", Number(event.target.value))
                        }
                      />
                    </label>
                    <label>
                      <span>Y</span>
                      <input
                        type="number"
                        step={0.1}
                        value={volume.y}
                        onChange={(event) =>
                          updateVolume(volume.id, "y", Number(event.target.value))
                        }
                      />
                    </label>
                    <label>
                      <span>高さ</span>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={volume.height}
                        onChange={(event) =>
                          updateVolume(volume.id, "height", Number(event.target.value))
                        }
                      />
                    </label>
                    <label>
                      <span>幅</span>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={volume.width}
                        onChange={(event) =>
                          updateVolume(volume.id, "width", Number(event.target.value))
                        }
                      />
                    </label>
                    <label>
                      <span>奥行</span>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={volume.depth}
                        onChange={(event) =>
                          updateVolume(volume.id, "depth", Number(event.target.value))
                        }
                      />
                    </label>
                    <label>
                      <span>区分</span>
                      <select
                        value={volume.kind}
                        onChange={(event) =>
                          updateVolume(volume.id, "kind", event.target.value as VolumeKind)
                        }
                      >
                        <option value="planned">計画建物</option>
                        <option value="context">周辺建物</option>
                      </select>
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="section-block">
            <div className="section-headline">
              <h3>境界別ルール</h3>
              <p>道路/隣地/固定閾値</p>
            </div>
            <div className="rule-grid">
              {(Object.keys(boundaryLabels) as BoundaryKey[]).map((boundary) => (
                <RuleCard
                  key={boundary}
                  boundary={boundary}
                  rule={request.boundary_rules[boundary]}
                  onChange={(field, value) =>
                    updateBoundaryRule(boundary, field, value)
                  }
                />
              ))}
            </div>
          </div>

          <div className="section-block">
            <h3>解析設定</h3>
            <div className="field-grid two-column compact-grid">
              <label>
                <span>観測点高さ</span>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={request.settings.measurement_height}
                  onChange={(event) =>
                    updateSettings("measurement_height", Number(event.target.value))
                  }
                />
              </label>
              <label>
                <span>測点ピッチ</span>
                <input
                  type="number"
                  min={0.2}
                  step={0.1}
                  value={request.settings.point_spacing}
                  onChange={(event) =>
                    updateSettings("point_spacing", Number(event.target.value))
                  }
                />
              </label>
              <label>
                <span>境界オフセット</span>
                <input
                  type="number"
                  min={0}
                  step={0.05}
                  value={request.settings.boundary_offset}
                  onChange={(event) =>
                    updateSettings("boundary_offset", Number(event.target.value))
                  }
                />
              </label>
              <label>
                <span>解析密度</span>
                <select
                  value={getQualityKey(request.settings)}
                  onChange={(event) => applyQualityPreset(event.target.value)}
                >
                  <option value="standard">標準</option>
                  <option value="dense">高精度</option>
                  <option value="custom">カスタム</option>
                </select>
              </label>
            </div>
            <p className="micro-copy">
              方位 {request.settings.sample_azimuth_divisions} 分割 / 仰角{" "}
              {request.settings.sample_altitude_divisions} 分割
            </p>
          </div>

          <div className="panel-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => void runAnalysis()}
              disabled={loading}
            >
              {loading ? "解析中..." : "天空率を再計算"}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={resetAll}
              disabled={loading}
            >
              初期値に戻す
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => result && downloadJsonReport(result)}
              disabled={!result}
            >
              JSON保存
            </button>
          </div>

          {error ? <p className="error-message">{error}</p> : null}
        </section>

        <div className="result-column">
          <PlanPreview
            site={request.site}
            volumes={request.volumes}
            points={result?.observation_points ?? []}
          />

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Results</p>
                <h2>解析結果</h2>
              </div>
              <p className="panel-note">
                最小差分 {result ? formatNumber(result.summary.minimum_margin_percent) : "--"}%
              </p>
            </div>

            {result ? (
              <>
                <div className="summary-grid">
                  <div className="summary-card">
                    <span>最低天空率</span>
                    <strong>{formatNumber(result.summary.minimum_percent)}%</strong>
                    <small>最小測点 {result.summary.worst_point_id}</small>
                  </div>
                  <div className="summary-card">
                    <span>最低基準値</span>
                    <strong>
                      {formatNumber(result.summary.minimum_reference_percent)}%
                    </strong>
                    <small>平均 {formatNumber(result.summary.average_percent)}%</small>
                  </div>
                  <div className="summary-card">
                    <span>適合率</span>
                    <strong>{formatNumber(result.summary.pass_rate)}%</strong>
                    <small>
                      最小差分 {formatNumber(result.summary.minimum_margin_percent)}%
                    </small>
                  </div>
                </div>

                <div className="table-section">
                  <div className="section-headline">
                    <h3>境界別サマリー</h3>
                  </div>
                  <table className="result-table">
                    <thead>
                      <tr>
                        <th>境界</th>
                        <th>点数</th>
                        <th>実天空率</th>
                        <th>基準</th>
                        <th>最小差分</th>
                        <th>適合率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.boundaries.map((boundary) => (
                        <tr key={boundary.boundary}>
                          <td>{boundaryLabels[boundary.boundary]}</td>
                          <td>{boundary.point_count}</td>
                          <td>{formatNumber(boundary.minimum_percent)}%</td>
                          <td>{formatNumber(boundary.minimum_reference_percent)}%</td>
                          <td>{formatNumber(boundary.minimum_margin_percent)}%</td>
                          <td>{formatNumber(boundary.pass_rate)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="table-section">
                  <div className="section-headline">
                    <h3>要確認ポイント</h3>
                    <p>{worstPoints.length} 点を表示</p>
                  </div>
                  <table className="result-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>境界</th>
                        <th>ルール</th>
                        <th>実</th>
                        <th>基準</th>
                        <th>差分</th>
                        <th>判定</th>
                      </tr>
                    </thead>
                    <tbody>
                      {worstPoints.map((point) => (
                        <tr key={point.id}>
                          <td>{point.id}</td>
                          <td>{boundaryLabels[point.boundary]}</td>
                          <td>{ruleLabels[point.rule_type]}</td>
                          <td>{formatNumber(point.sky_factor_percent)}%</td>
                          <td>{formatNumber(point.reference_sky_factor_percent)}%</td>
                          <td>{formatNumber(point.margin_percent)}%</td>
                          <td>{point.passes ? "適合" : "不足"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="assumptions">
                  {result.assumptions.map((assumption) => (
                    <p key={assumption}>{assumption}</p>
                  ))}
                </div>
              </>
            ) : (
              <p className="empty-state">
                解析条件を入力して天空率を計算してください。
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

