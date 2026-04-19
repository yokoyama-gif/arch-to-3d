import { PDFDocument, degrees } from 'pdf-lib'
import type { PageItem, SourceFile } from '../../types'

export async function getPageCount(data: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(data, { ignoreEncryption: true })
  return doc.getPageCount()
}

export async function buildPDF(
  pages: PageItem[],
  sourceFiles: Map<string, SourceFile>
): Promise<Uint8Array> {
  const outputDoc = await PDFDocument.create()

  // ソースファイルごとに PDFDocument をロード（同一ファイルは再利用）
  const sourceDocCache = new Map<string, PDFDocument>()

  for (const page of pages) {
    const sourceFile = sourceFiles.get(page.sourceFileId)
    if (!sourceFile) continue

    if (!sourceDocCache.has(page.sourceFileId)) {
      const doc = await PDFDocument.load(sourceFile.data, { ignoreEncryption: true })
      sourceDocCache.set(page.sourceFileId, doc)
    }

    const sourceDoc = sourceDocCache.get(page.sourceFileId)!
    const [copiedPage] = await outputDoc.copyPages(sourceDoc, [page.pageIndex])

    // 元の回転 + アプリ上での追加回転を合算して設定
    if (page.rotation !== 0) {
      const currentAngle = copiedPage.getRotation().angle
      copiedPage.setRotation(degrees((currentAngle + page.rotation + 360) % 360))
    }

    outputDoc.addPage(copiedPage)
  }

  return outputDoc.save()
}

export async function buildSelectedPDF(
  pages: PageItem[],
  selectedIds: Set<string>,
  sourceFiles: Map<string, SourceFile>
): Promise<Uint8Array> {
  const selectedPages = pages.filter((p) => selectedIds.has(p.id))
  if (selectedPages.length === 0) throw new Error('選択されたページがありません')
  return buildPDF(selectedPages, sourceFiles)
}
