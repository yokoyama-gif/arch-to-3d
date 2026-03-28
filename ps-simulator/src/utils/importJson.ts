import type { PlanData } from "../domain/types";

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
          const data = JSON.parse(reader.result as string) as PlanData;
          resolve(data);
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
