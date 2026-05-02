import { useRef, useState } from "react";
import type { BackgroundImage } from "../domain/types";
import { loadBackgroundFromFile } from "../utils/loadBackground";
import { CANVAS_DEFAULTS } from "../domain/rules/canvasDefaults";
import { NumberInput } from "./NumberInput";

type Props = {
  backgroundImage: BackgroundImage | null;
  onSet: (img: BackgroundImage | null) => void;
  onUpdate: (patch: Partial<BackgroundImage>) => void;
  /** 校正モード ON/OFF を親で管理 */
  calibrationMode: boolean;
  onToggleCalibration: () => void;
  /** 図面移動モード ON/OFF（ON時のみ背景がドラッグできる） */
  bgDragMode: boolean;
  onToggleBgDragMode: () => void;
  /** 現在のグリッド寸法(mm) - スナップ計算に使用 */
  gridSizeMm: number;
  /** モジュール寸法(mm) - 粗いスナップ用 */
  moduleMm: number;
  /** スナップ単位を「モジュール」にするか（false=細グリッド） */
  snapToModule: boolean;
  onToggleSnapToModule: () => void;
  /** 柱マーク追加モード */
  markingMode: boolean;
  onToggleMarkingMode: () => void;
  onClearMarkers: () => void;
  /** 1番目のマーカーで全体をグリッド整列 */
  onAlignByFirstMarker: () => void;
  /** グリッドオフセットを0にリセット */
  onResetGridOffset: () => void;
  /** 現在のグリッドオフセット表示用 */
  gridOffsetMm: { x: number; y: number };
};

/**
 * 背景画像/PDFのアップロードと位置・寸法・透明度の調整パネル。
 * 平面図を下絵として読み込み、グリッドの後ろに表示するための設定。
 */
export function BackgroundPanel({
  backgroundImage,
  onSet,
  onUpdate,
  calibrationMode,
  onToggleCalibration,
  bgDragMode,
  onToggleBgDragMode,
  gridSizeMm,
  moduleMm,
  snapToModule,
  onToggleSnapToModule,
  markingMode,
  onToggleMarkingMode,
  onClearMarkers,
  onAlignByFirstMarker,
  onResetGridOffset,
  gridOffsetMm,
}: Props) {
  const snapStep = snapToModule ? moduleMm : gridSizeMm;
  const markerCount = backgroundImage?.markers?.length ?? 0;
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await loadBackgroundFromFile(file);
      // キャンバス（A3@1/100=42000×29700mm）全体に自動フィット。
      // 用紙比率と異なる画像は引き伸ばされるが、後でユーザーが微調整可能。
      const fitted: BackgroundImage = {
        ...raw,
        x: 0,
        y: 0,
        widthMm: CANVAS_DEFAULTS.widthMm,
        heightMm: CANVAS_DEFAULTS.heightMm,
      };
      onSet(fitted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読込失敗");
    } finally {
      setLoading(false);
      // 同じファイルを連続選択できるようにリセット
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div style={{ fontSize: 12 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>背景平面図</h3>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          style={{
            padding: "4px 8px",
            fontSize: 11,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "読込中..." : "画像/PDFを読込"}
        </button>
        {backgroundImage && (
          <button
            onClick={() => onSet(null)}
            style={{
              padding: "4px 8px",
              fontSize: 11,
              cursor: "pointer",
              color: "#f44336",
            }}
          >
            クリア
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,.pdf"
          onChange={handleFile}
          style={{ display: "none" }}
        />
      </div>

      {error && (
        <div
          style={{
            background: "#ffebee",
            color: "#c62828",
            padding: 4,
            borderRadius: 3,
            fontSize: 11,
            marginBottom: 6,
          }}
        >
          {error}
        </div>
      )}

      {/* グリッド合わせ用のアクションボタン */}
      {backgroundImage && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
          <button
            onClick={onToggleBgDragMode}
            style={{
              padding: "4px 8px",
              fontSize: 11,
              cursor: "pointer",
              background: bgDragMode ? "#1976d2" : "#f5f5f5",
              color: bgDragMode ? "#fff" : undefined,
              fontWeight: bgDragMode ? 700 : 400,
            }}
            title="ONの間、ドラッグや十字キーでグリッドを動かして図面に合わせます（図面は固定）"
          >
            {bgDragMode ? "グリッド移動中" : "グリッドを移動"}
          </button>
          <button
            onClick={onToggleCalibration}
            style={{
              padding: "4px 8px",
              fontSize: 11,
              cursor: "pointer",
              background: calibrationMode ? "#ffc107" : "#f5f5f5",
              fontWeight: calibrationMode ? 700 : 400,
            }}
            title="図面上の2点をクリック → 実距離(mm)を入力すると、その距離になるよう図面が自動でスケーリングされます"
          >
            {calibrationMode ? "校正中…2点クリック" : "2点指定で校正"}
          </button>
          <button
            onClick={() =>
              onUpdate({ grayscale: !backgroundImage.grayscale })
            }
            style={{
              padding: "4px 8px",
              fontSize: 11,
              cursor: "pointer",
              background: backgroundImage.grayscale ? "#424242" : "#f5f5f5",
              color: backgroundImage.grayscale ? "#fff" : undefined,
              fontWeight: backgroundImage.grayscale ? 700 : 400,
            }}
            title="図面をグレースケール表示に切り替えます。色付き設備が見やすくなります"
          >
            {backgroundImage.grayscale ? "白黒ON" : "白黒"}
          </button>
          <button
            onClick={onToggleSnapToModule}
            style={{
              padding: "4px 8px",
              fontSize: 11,
              cursor: "pointer",
              background: snapToModule ? "#4caf50" : "#f5f5f5",
              color: snapToModule ? "#fff" : undefined,
              fontWeight: snapToModule ? 700 : 400,
            }}
            title={
              snapToModule
                ? `モジュール(${moduleMm}mm)単位で動く - 大きく動かして粗合わせ`
                : `細グリッド(${gridSizeMm}mm)単位で動く - 細かい位置調整`
            }
          >
            スナップ: {snapToModule ? `モジュール(${moduleMm})` : `細(${gridSizeMm})`}
          </button>
          <button
            onClick={() => {
              // 位置・寸法を現在の snapStep にスナップ
              const snap = (v: number) =>
                Math.round(v / snapStep) * snapStep;
              onUpdate({
                x: snap(backgroundImage.x),
                y: snap(backgroundImage.y),
                widthMm: Math.max(snapStep, snap(backgroundImage.widthMm)),
                heightMm: Math.max(snapStep, snap(backgroundImage.heightMm)),
              });
            }}
            style={{ padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
            title={`位置と寸法を ${snapStep}mm の倍数に丸めます`}
          >
            今すぐ整列
          </button>
          <button
            onClick={() => {
              // 左上を最寄りのモジュール交点へスナップ（粗合わせ）
              const snapX = Math.round(backgroundImage.x / moduleMm) * moduleMm;
              const snapY = Math.round(backgroundImage.y / moduleMm) * moduleMm;
              onUpdate({ x: snapX, y: snapY });
            }}
            style={{ padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
            title={`図面の左上をモジュール(${moduleMm}mm)交点へ最寄りスナップ`}
          >
            左上→モジュール交点
          </button>
          <button
            onClick={() => onUpdate({ x: 0, y: 0 })}
            style={{ padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
            title="図面の左上を原点(0,0)に戻す"
          >
            図面を原点へ
          </button>
          <button
            onClick={onResetGridOffset}
            style={{ padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
            title="グリッドオフセットを 0 にリセット（グリッドが原点スタートに戻る）"
          >
            グリッドリセット
          </button>
        </div>
      )}

      {/* 柱マーク機能 */}
      {backgroundImage && (
        <div
          style={{
            marginTop: 8,
            padding: 6,
            background: "#f9fbe7",
            border: "1px solid #c5e1a5",
            borderRadius: 4,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
            柱マーク → グリッド整列 (現在 {markerCount} 個)
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button
              onClick={onToggleMarkingMode}
              style={{
                padding: "4px 8px",
                fontSize: 11,
                cursor: "pointer",
                background: markingMode ? "#ef5350" : "#f5f5f5",
                color: markingMode ? "#fff" : undefined,
                fontWeight: markingMode ? 700 : 400,
              }}
              title="ON中、図面上の柱中心をクリックすると赤い点が打たれます"
            >
              {markingMode ? "マーク追加中…" : "柱マーク追加"}
            </button>
            <button
              onClick={onAlignByFirstMarker}
              disabled={markerCount === 0}
              style={{
                padding: "4px 8px",
                fontSize: 11,
                cursor: markerCount === 0 ? "not-allowed" : "pointer",
                opacity: markerCount === 0 ? 0.5 : 1,
              }}
              title="1番目のマークの絶対座標にグリッド交点が来るよう、グリッドオフセットを設定"
            >
              1番目のマークにグリッド合わせ
            </button>
            <button
              onClick={onClearMarkers}
              disabled={markerCount === 0}
              style={{
                padding: "4px 8px",
                fontSize: 11,
                cursor: markerCount === 0 ? "not-allowed" : "pointer",
                opacity: markerCount === 0 ? 0.5 : 1,
                color: "#f44336",
              }}
            >
              全マーク削除
            </button>
          </div>
          <button
            onClick={() =>
              onUpdate({
                x: 0,
                y: 0,
                widthMm: CANVAS_DEFAULTS.widthMm,
                heightMm: CANVAS_DEFAULTS.heightMm,
              })
            }
            style={{ padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
            title="図面をキャンバス全体(A3@1/100=42×29.7m)に再フィットします"
          >
            A3全体にフィット
          </button>
        </div>
      )}

      {backgroundImage && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "4px 8px",
            alignItems: "center",
          }}
        >
          <label>X (mm)</label>
          <NumberInput
            value={backgroundImage.x}
            step={50}
            onChange={(v) => onUpdate({ x: v })}
            style={inputStyle}
          />
          <label>Y (mm)</label>
          <NumberInput
            value={backgroundImage.y}
            step={50}
            onChange={(v) => onUpdate({ y: v })}
            style={inputStyle}
          />
          <label>幅 (mm)</label>
          <NumberInput
            value={backgroundImage.widthMm}
            step={100}
            min={100}
            onChange={(v) => onUpdate({ widthMm: v })}
            style={inputStyle}
          />
          <label>高さ (mm)</label>
          <NumberInput
            value={backgroundImage.heightMm}
            step={100}
            min={100}
            onChange={(v) => onUpdate({ heightMm: v })}
            style={inputStyle}
          />
          <label>不透明度</label>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={backgroundImage.opacity}
            onChange={(e) =>
              onUpdate({ opacity: Number(e.target.value) })
            }
            style={{ width: "100%" }}
          />
        </div>
      )}

      {!backgroundImage && (
        <div style={{ color: "#888", fontSize: 11 }}>
          PNG/JPG/PDFファイルをアップロードできます。
          読込後にX/Y位置と幅/高さで配置を合わせてください。
        </div>
      )}

      {/* グリッドオフセット現在値 */}
      <div
        style={{
          marginTop: 6,
          fontSize: 11,
          color: "#555",
          padding: "3px 6px",
          background: "#eef",
          borderRadius: 3,
        }}
      >
        グリッドオフセット: ({(gridOffsetMm?.x ?? 0).toFixed(1)}, {(gridOffsetMm?.y ?? 0).toFixed(1)}) mm
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "1px 4px",
  fontSize: 11,
  boxSizing: "border-box",
};
