import type { PlanData } from "../domain/types";

/**
 * JSONデータがPlanDataの必須フィールドを持っているか検証する。
 * 型レベルではなく実行時の最低限のバリデーション。
 */
function validatePlanData(data: unknown): data is PlanData {
  if (data == null || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;

  // 必須フィールドの存在チェック
  if (typeof obj.name !== "string") return false;
  if (!Array.isArray(obj.fixtures)) return false;
  if (obj.buildingSettings == null || typeof obj.buildingSettings !== "object") return false;

  // buildingSettingsの最低限チェック
  const bs = obj.buildingSettings as Record<string, unknown>;
  if (typeof bs.floors !== "number") return false;
  if (typeof bs.gridSizeMm !== "number") return false;

  // fixturesの各要素チェック
  for (const f of obj.fixtures as unknown[]) {
    if (f == null || typeof f !== "object") return false;
    const fix = f as Record<string, unknown>;
    if (typeof fix.id !== "string") return false;
    if (typeof fix.type !== "string") return false;
    if (typeof fix.x !== "number" || typeof fix.y !== "number") return false;
    if (typeof fix.w !== "number" || typeof fix.h !== "number") return false;
  }

  return true;
}

export function importPlanFromJson(): Promise<PlanData> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error("ファイルが選択されませんでした"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          if (!validatePlanData(parsed)) {
            reject(new Error(
              "JSONの形式が不正です。PS Simulatorで保存したファイルを選択してください。"
            ));
            return;
          }
          resolve(parsed);
        } catch {
          reject(new Error("JSONの解析に失敗しました"));
        }
      };
      reader.onerror = () => reject(new Error("ファイル読み込みエラー"));
      reader.readAsText(file);
    };
    input.click();
  });
}
