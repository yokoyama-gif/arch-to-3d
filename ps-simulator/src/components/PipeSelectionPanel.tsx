import type { Fixture, PipeRoute, PipeType } from "../domain/types";
import { fixtureLabels } from "../domain/rules/fixtureDefaults";
import { pipeTypeLabels, pipeColors } from "../domain/rules/pipeSpecs";

type Props = {
  selected: { fixtureId: string; pipeType: PipeType } | null;
  fixtures: Fixture[];
  pipeRoutes: PipeRoute[];
  onClearCustom: () => void;
  onDeselect: () => void;
};

/**
 * 選択中の配管ルートの情報表示パネル。
 * - 設備名・管種・長さ・コーナー数
 * - 「自動L字に戻す」ボタン (customPipePoints をクリア)
 * - 「選択解除」ボタン
 */
export function PipeSelectionPanel({
  selected,
  fixtures,
  pipeRoutes,
  onClearCustom,
  onDeselect,
}: Props) {
  if (!selected) return null;
  const fixture = fixtures.find((f) => f.id === selected.fixtureId);
  const route = pipeRoutes.find(
    (r) => r.fixtureId === selected.fixtureId && r.pipeType === selected.pipeType
  );
  if (!fixture || !route) return null;
  const cornerCount = Math.max(0, route.points.length - 2);
  const hasCustom = (fixture.customPipePoints?.[selected.pipeType]?.length ?? 0) > 0;
  return (
    <div
      style={{
        background: "#fff",
        border: "1.5px solid #1976d2",
        borderRadius: 4,
        padding: 8,
        fontSize: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 12,
            height: 12,
            background: pipeColors[selected.pipeType],
            border: "1px solid #888",
          }}
        />
        <strong>配管編集中: {pipeTypeLabels[selected.pipeType]}</strong>
      </div>
      <div style={{ color: "#444", lineHeight: 1.6 }}>
        設備: {fixtureLabels[fixture.type]}
        <br />
        ルート長: {route.lengthMm.toFixed(0)} mm
        <br />
        コーナー数: {cornerCount}
        <br />
        手動編集: {hasCustom ? "あり" : "自動L字"}
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
        <button
          onClick={onClearCustom}
          disabled={!hasCustom}
          style={{
            padding: "4px 8px",
            fontSize: 11,
            cursor: hasCustom ? "pointer" : "not-allowed",
            opacity: hasCustom ? 1 : 0.5,
          }}
          title="手動で設定したコーナーを全削除して自動L字に戻す"
        >
          自動L字に戻す
        </button>
        <button
          onClick={onDeselect}
          style={{ padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
        >
          選択解除
        </button>
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: "#888", lineHeight: 1.4 }}>
        操作: 線分↕↔ドラッグで移動 / セグメントダブルクリックで中間点追加 / コーナー◯ドラッグで個別移動 / コーナーDoubleClickで削除
      </div>
    </div>
  );
}
