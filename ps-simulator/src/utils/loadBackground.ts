import type { BackgroundImage } from "../domain/types";

/**
 * デフォルト表示寸法（mm）。
 * 1pxを1mmと仮定して読み込み、ユーザーが後で寸法調整する想定。
 */
const DEFAULT_PX_PER_MM = 1;

/**
 * 画像ファイル(PNG/JPG/WebP等)をBackgroundImageとして読み込む。
 * 幅・高さは元画像のpixelをそのままmm相当として初期化。
 */
function loadImageFile(file: File): Promise<BackgroundImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        resolve({
          dataUrl,
          x: 0,
          y: 0,
          widthMm: img.width / DEFAULT_PX_PER_MM,
          heightMm: img.height / DEFAULT_PX_PER_MM,
          opacity: 0.5,
        });
      };
      img.onerror = () => reject(new Error("画像の解析に失敗しました"));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error("ファイル読込エラー"));
    reader.readAsDataURL(file);
  });
}

/**
 * PDFファイルの1ページ目をPNGデータURLに変換してBackgroundImageを返す。
 * pdfjs-dist を動的importで読み込み、初回のみ依存解決する。
 */
async function loadPdfFile(file: File): Promise<BackgroundImage> {
  // 動的importでpdfjs-distを読み込み（バンドルを軽くする）
  const pdfjs = await import("pdfjs-dist");
  // ワーカー未設定だと警告が出るので、CDN経由で設定（オフライン環境でない想定）
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  // 適度な解像度でレンダリング（A3判想定で4倍程度）
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context取得失敗");
  await page.render({ canvas, viewport }).promise;

  const dataUrl = canvas.toDataURL("image/png");
  return {
    dataUrl,
    x: 0,
    y: 0,
    widthMm: canvas.width / DEFAULT_PX_PER_MM,
    heightMm: canvas.height / DEFAULT_PX_PER_MM,
    opacity: 0.5,
  };
}

/**
 * 画像/PDFどちらでも受け付けて BackgroundImage に変換する。
 * 拡張子で判別する単純実装。
 */
export async function loadBackgroundFromFile(
  file: File
): Promise<BackgroundImage> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) {
    return loadPdfFile(file);
  }
  return loadImageFile(file);
}
