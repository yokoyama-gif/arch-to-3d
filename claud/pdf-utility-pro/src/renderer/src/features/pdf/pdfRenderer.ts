import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'

// Vite の ?url インポートでワーカーを設定
// electron-vite の renderer は Vite で処理されるので import.meta.url が使える
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).href

const THUMBNAIL_MAX_WIDTH = 140
const THUMBNAIL_MAX_HEIGHT = 180

// ソースファイルごとに PDFDocument をキャッシュ（再生成コスト削減）
const documentCache = new Map<string, PDFDocumentProxy>()

async function getDocument(data: Uint8Array, cacheKey: string): Promise<PDFDocumentProxy> {
  if (documentCache.has(cacheKey)) {
    return documentCache.get(cacheKey)!
  }
  const doc = await pdfjsLib.getDocument({ data: data.slice() }).promise
  documentCache.set(cacheKey, doc)
  return doc
}

export function evictDocumentCache(cacheKey: string): void {
  const doc = documentCache.get(cacheKey)
  if (doc) {
    doc.destroy()
    documentCache.delete(cacheKey)
  }
}

export async function renderPageThumbnail(
  data: Uint8Array,
  cacheKey: string,
  pageIndex: number,
  rotation: number = 0
): Promise<string> {
  const doc = await getDocument(data, cacheKey)
  // pdfjs はページ番号が 1 始まり
  const page = await doc.getPage(pageIndex + 1)

  const unrotatedViewport = page.getViewport({ scale: 1, rotation: 0 })
  const scaleX = THUMBNAIL_MAX_WIDTH / unrotatedViewport.width
  const scaleY = THUMBNAIL_MAX_HEIGHT / unrotatedViewport.height
  const scale = Math.min(scaleX, scaleY)

  // rotation を含めたビューポートでキャンバスサイズを確定
  const viewport = page.getViewport({ scale, rotation })

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)

  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport }).promise

  return canvas.toDataURL('image/jpeg', 0.82)
}
