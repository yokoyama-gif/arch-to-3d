import type { Anchor } from "../utils/geometry";
import { ALL_ANCHORS } from "../utils/geometry";

type Props = {
  value: Anchor;
  onChange: (a: Anchor) => void;
  /** 表示ラベル（例: "柱の配置基準点"） */
  label?: string;
};

const anchorLabels: Record<Anchor, string> = {
  tl: "左上",
  tc: "上中央",
  tr: "右上",
  ml: "左中央",
  mc: "中心",
  mr: "右中央",
  bl: "左下",
  bc: "下中央",
  br: "右下",
};

/**
 * 矩形の9点アンカーを選択するピッカー。
 * 3×3の点で構成され、選択中の点が青く表示される。
 */
export function AnchorPicker({ value, onChange, label }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        background: "#fafafa",
        border: "1px solid #ddd",
        borderRadius: 4,
        fontSize: 12,
      }}
    >
      {label && <span style={{ color: "#555" }}>{label}:</span>}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 16px)",
          gridTemplateRows: "repeat(3, 16px)",
          gap: 2,
          padding: 4,
          background: "#fff",
          border: "1px solid #999",
          borderRadius: 2,
        }}
      >
        {ALL_ANCHORS.map((a) => {
          const selected = a === value;
          return (
            <button
              key={a}
              onClick={() => onChange(a)}
              title={anchorLabels[a]}
              style={{
                width: 16,
                height: 16,
                padding: 0,
                cursor: "pointer",
                border: "none",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  display: "block",
                  width: selected ? 10 : 6,
                  height: selected ? 10 : 6,
                  borderRadius: "50%",
                  background: selected ? "#1976d2" : "#bbb",
                }}
              />
            </button>
          );
        })}
      </div>
      <span style={{ color: "#1976d2", fontWeight: 600 }}>
        {anchorLabels[value]}
      </span>
    </div>
  );
}
