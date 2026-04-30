import { useRef, useState } from "react";
import type { BackgroundImage } from "../domain/types";
import { loadBackgroundFromFile } from "../utils/loadBackground";
import { NumberInput } from "./NumberInput";

type Props = {
  backgroundImage: BackgroundImage | null;
  onSet: (img: BackgroundImage | null) => void;
  onUpdate: (patch: Partial<BackgroundImage>) => void;
};

/**
 * 背景画像/PDFのアップロードと位置・寸法・透明度の調整パネル。
 * 平面図を下絵として読み込み、グリッドの後ろに表示するための設定。
 */
export function BackgroundPanel({ backgroundImage, onSet, onUpdate }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const img = await loadBackgroundFromFile(file);
      onSet(img);
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
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "1px 4px",
  fontSize: 11,
  boxSizing: "border-box",
};
