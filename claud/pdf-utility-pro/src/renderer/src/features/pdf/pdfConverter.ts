import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import type { PageItem, SourceFile, ImageFileData } from '../../types'

export type ImageFormat = 'png' | 'jpeg'

export interface ImageExportOptions {
  format: ImageFormat
  scale: number      // レンダリング倍率（2.0 = 標準、3.0 = 高画質）
  jpegQuality: number // 0-1、JPEGのみ
}

/**
 * 1ページをcanvasに描画しArrayBufferで返す
 */
export async function renderPageAsImage(
  sf: SourceFile,
  pageIndex: number,
  rotation: number,
  opts: ImageExportOptions
): Promise<ArrayBuffer> {
  const doc = await pdfjsLib.getDocument({ data: sf.data.slice() }).promise
  const page = await doc.getPage(pageIndex + 1)
  const vp = page.getViewport({ scale: opts.scale, rotation })

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(vp.width)
  canvas.height = Math.round(vp.height)
  const ctx = canvas.getContext('2d')!
  // JPEGは白背景
  if (opts.format === 'jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  await page.render({ canvasContext: ctx, viewport: vp }).promise

  return new Promise<ArrayBuffer>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('canvas.toBlob に失敗しました')); return }
        blob.arrayBuffer().then(resolve, reject)
      },
      opts.format === 'png' ? 'image/png' : 'image/jpeg',
      opts.format === 'jpeg' ? opts.jpegQuality : undefined
    )
  })
}

/**
 * PDFの全テキストを抽出して結合
 */
export async function extractPageText(
  sf: SourceFile,
  pageIndex: number
): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: sf.data.slice() }).promise
  const page = await doc.getPage(pageIndex + 1)
  const content = await page.getTextContent()
  // items を行っぽく結合
  let out = ''
  let lastY: number | null = null
  for (const item of content.items as Array<{ str: string; transform?: number[] }>) {
    const y = item.transform ? item.transform[5] : null
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) out += '\n'
    out += item.str
    if (y !== null) lastY = y
  }
  return out
}

/**
 * 画像ファイルをPDFに変換（各画像を1ページとする）
 */
export async function imagesToPDF(images: ImageFileData[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  for (const img of images) {
    const bytes = new Uint8Array(img.data)
    const embedded =
      img.type === 'image/png'
        ? await pdfDoc.embedPng(bytes)
        : await pdfDoc.embedJpg(bytes)
    const page = pdfDoc.addPage([embedded.width, embedded.height])
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height })
  }
  return pdfDoc.save()
}

/**
 * ファイル名から拡張子を除いたベース名
 */
export function basenameWithoutExt(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

/**
 * 連番付きファイル名を組み立てる
 */
export function pageImageFilename(
  baseName: string,
  pageIndex: number,
  totalPages: number,
  format: ImageFormat
): string {
  const digits = String(totalPages).length
  const num = String(pageIndex + 1).padStart(Math.max(3, digits), '0')
  return `${baseName}_p${num}.${format}`
}

/**
 * 選択ページを画像ファイルとしてフォルダに出力
 */
export async function exportPagesAsImages(
  pages: PageItem[],
  sourceFiles: Map<string, SourceFile>,
  folderPath: string,
  opts: ImageExportOptions,
  onProgress?: (done: number, total: number, currentName: string) => void
): Promise<{ saved: number; failed: string[] }> {
  const failed: string[] = []
  let saved = 0
  const total = pages.length

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const sf = sourceFiles.get(page.sourceFileId)
    if (!sf) { failed.push(`p.${i + 1}`); continue }

    const baseName = basenameWithoutExt(page.sourceFileName)
    const fileName = pageImageFilename(baseName, i, total, opts.format)
    // パス区切りは Windows / Unix どちらも動くように「/」で結合 → path API を挟むと Electron 依存になるので主プロセス側の fs が解決
    const sep = folderPath.includes('\\') ? '\\' : '/'
    const filePath = folderPath + sep + fileName

    try {
      const ab = await renderPageAsImage(sf, page.pageIndex, page.rotation, opts)
      await window.electronAPI.writeToPath(filePath, ab)
      saved++
      onProgress?.(i + 1, total, fileName)
    } catch (err) {
      console.error(`画像出力失敗 ${fileName}:`, err)
      failed.push(fileName)
    }
  }
  return { saved, failed }
}

/**
 * 選択ページのテキストを抽出して1つのテキストファイルとして保存
 */
export async function extractTextFromPages(
  pages: PageItem[],
  sourceFiles: Map<string, SourceFile>
): Promise<string> {
  let out = ''
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const sf = sourceFiles.get(page.sourceFileId)
    if (!sf) continue
    out += `===== ページ ${i + 1}（${page.sourceFileName}, 元 p.${page.pageIndex + 1}） =====\n`
    try {
      const text = await extractPageText(sf, page.pageIndex)
      out += text + '\n\n'
    } catch (err) {
      out += '(テキスト抽出に失敗しました)\n\n'
    }
  }
  return out
}
