import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'

import { Toolbar } from './components/Toolbar'
import { ThumbnailGrid } from './components/ThumbnailGrid'
import { StatusBar } from './components/StatusBar'
import { ZoomModal } from './components/ZoomModal'
import { HelpModal } from './components/HelpModal'
import { ConvertModal, type ConvertConfig } from './components/ConvertModal'
import {
  exportPagesAsImages,
  extractTextFromPages,
  imagesToPDF
} from './features/pdf/pdfConverter'
import { renderPageThumbnail, evictDocumentCache } from './features/pdf/pdfRenderer'
import { getPageCount, buildPDF, buildSelectedPDF } from './features/pdf/pdfProcessor'
import type { PageItem, SourceFile, FileData } from './types'

// ───────────────────────────────────────────────
// ユーティリティ
// ───────────────────────────────────────────────
let _idCounter = 0
function uid(): string {
  return `${Date.now()}-${++_idCounter}`
}

// ───────────────────────────────────────────────
// App
// ───────────────────────────────────────────────
export default function App() {
  const [sourceFiles, setSourceFiles] = useState<Map<string, SourceFile>>(new Map())
  const [pages, setPages] = useState<PageItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState(
    'PDFファイルをドラッグ＆ドロップ、または「ファイル追加」で追加してください'
  )
  // undo 用の履歴（最大20ステップ）
  const [history, setHistory] = useState<PageItem[][]>([])
  // 拡大モーダル
  const [zoomOpen, setZoomOpen] = useState(false)
  // ヘルプモーダル
  const [helpOpen, setHelpOpen] = useState(false)
  // 変換モーダル
  const [convertOpen, setConvertOpen] = useState(false)
  // サムネイル生成キューの中断フラグ
  const thumbAbortRef = useRef<{ cancelled: boolean }>({ cancelled: false })

  // ───────────────────────
  // DnD センサー
  // ───────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ───────────────────────
  // 履歴管理
  // ───────────────────────
  const pushHistory = useCallback((snapshot: PageItem[]) => {
    setHistory((prev) => [...prev.slice(-19), snapshot])
  }, [])

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev
      const next = [...prev]
      const restored = next.pop()!
      setPages(restored)
      setSelectedIds(new Set())
      setStatusMsg('操作を元に戻しました')
      return next
    })
  }, [])

  // ───────────────────────
  // サムネイル非同期生成
  // ───────────────────────
  const generateThumbnails = useCallback(
    async (targets: PageItem[], sfMap: Map<string, SourceFile>) => {
      // 前回のキューをキャンセル
      thumbAbortRef.current.cancelled = true
      const token = { cancelled: false }
      thumbAbortRef.current = token

      for (const page of targets) {
        if (token.cancelled) break
        const sf = sfMap.get(page.sourceFileId)
        if (!sf) continue

        try {
          const thumbnail = await renderPageThumbnail(sf.data, sf.id, page.pageIndex, page.rotation)
          if (token.cancelled) break
          setPages((prev) =>
            prev.map((p) => (p.id === page.id ? { ...p, thumbnail } : p))
          )
        } catch (err) {
          console.error(`サムネイル生成失敗: ${page.sourceFileName} p.${page.pageIndex + 1}`, err)
        }
      }
    },
    []
  )

  // ───────────────────────
  // ファイルロード共通処理
  // ───────────────────────
  const loadFiles = useCallback(
    async (fileDataList: FileData[]) => {
      if (fileDataList.length === 0) return
      setIsLoading(true)
      setStatusMsg('PDFを読み込んでいます…')

      try {
        const newSF = new Map(sourceFiles)
        const newPages: PageItem[] = []
        let skipCount = 0

        for (const fd of fileDataList) {
          const data = new Uint8Array(fd.data)
          let pageCount: number

          try {
            pageCount = await getPageCount(data)
          } catch {
            skipCount++
            setStatusMsg(`⚠ ${fd.name} は読み込めませんでした（破損・暗号化PDFの可能性）`)
            continue
          }

          const sfId = uid()
          newSF.set(sfId, { id: sfId, name: fd.name, path: fd.path, data, pageCount })

          for (let i = 0; i < pageCount; i++) {
            newPages.push({
              id: uid(),
              sourceFileId: sfId,
              sourceFileName: fd.name,
              pageIndex: i,
              rotation: 0,
              thumbnail: null
            })
          }
        }

        setSourceFiles(newSF)
        setPages((prev) => [...prev, ...newPages])

        const loaded = fileDataList.length - skipCount
        setStatusMsg(
          `${loaded}ファイル（${newPages.length}ページ）を追加しました。サムネイルを生成中…`
        )

        // 非同期でサムネイル生成
        generateThumbnails(newPages, newSF)
      } catch (err) {
        console.error(err)
        setStatusMsg('エラー: ファイルの読み込みに失敗しました')
      } finally {
        setIsLoading(false)
      }
    },
    [sourceFiles, generateThumbnails]
  )

  // ───────────────────────
  // ファイル追加ダイアログ
  // ───────────────────────
  const handleAddFiles = useCallback(async () => {
    try {
      const list = await window.electronAPI.openFiles()
      await loadFiles(list)
    } catch (err) {
      setStatusMsg('エラー: ファイルを開けませんでした')
    }
  }, [loadFiles])

  // ───────────────────────
  // OS ドラッグ＆ドロップ
  // ───────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  // 画像ファイル(File) → PDF 取り込み
  const importImagesAsPDF = useCallback(
    async (files: File[]) => {
      setIsLoading(true)
      setStatusMsg('画像をPDFに変換しています…')
      try {
        const imageData = await Promise.all(
          files.map(async (f) => ({
            path: f.name,
            name: f.name,
            data: await f.arrayBuffer(),
            type: (f.type === 'image/png' ? 'image/png' : 'image/jpeg') as 'image/png' | 'image/jpeg'
          }))
        )
        const pdfBytes = await imagesToPDF(imageData)
        const baseName = files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '') : '画像'
        await loadFiles([
          { path: baseName + '.pdf', name: baseName + '.pdf', data: pdfBytes.buffer as ArrayBuffer }
        ])
        setStatusMsg(`${files.length}枚の画像を1つのPDFとして追加しました`)
      } catch (err) {
        console.error(err)
        setStatusMsg('エラー: 画像のPDF変換に失敗しました')
      } finally {
        setIsLoading(false)
      }
    },
    [loadFiles]
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const files = Array.from(e.dataTransfer.files)
      const pdfPaths = files.filter((f) => f.name.toLowerCase().endsWith('.pdf')).map((f) => f.path)
      const imageFiles = files.filter((f) => /\.(png|jpe?g)$/i.test(f.name))

      if (pdfPaths.length === 0 && imageFiles.length === 0) {
        setStatusMsg('PDFまたは画像ファイル（PNG/JPEG）のみ追加できます')
        return
      }

      try {
        if (pdfPaths.length > 0) {
          const list = await window.electronAPI.readFiles(pdfPaths)
          await loadFiles(list)
        }
        if (imageFiles.length > 0) {
          await importImagesAsPDF(imageFiles)
        }
      } catch (err) {
        setStatusMsg('エラー: ドラッグ＆ドロップの読み込みに失敗しました')
      }
    },
    [loadFiles, importImagesAsPDF]
  )

  // 画像ファイルをダイアログから追加
  const handleAddImages = useCallback(async () => {
    try {
      const list = await window.electronAPI.openImages()
      if (list.length === 0) return
      setIsLoading(true)
      setStatusMsg('画像をPDFに変換しています…')
      const pdfBytes = await imagesToPDF(list)
      const baseName =
        list.length === 1 ? list[0].name.replace(/\.[^.]+$/, '') : '画像'
      await loadFiles([
        { path: baseName + '.pdf', name: baseName + '.pdf', data: pdfBytes.buffer as ArrayBuffer }
      ])
      setStatusMsg(`${list.length}枚の画像を1つのPDFとして追加しました`)
    } catch (err) {
      console.error(err)
      setStatusMsg('エラー: 画像の読み込み／変換に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [loadFiles])

  // ───────────────────────
  // ページ選択
  // ───────────────────────
  const handleSelectPage = useCallback(
    (id: string, e: React.MouseEvent) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)

        if (e.ctrlKey || e.metaKey) {
          // Ctrl+クリック: トグル
          if (next.has(id)) next.delete(id)
          else next.add(id)
        } else if (e.shiftKey && prev.size > 0) {
          // Shift+クリック: 範囲選択
          const ids = pages.map((p) => p.id)
          const anchor = [...prev][prev.size - 1]
          const anchorIdx = ids.indexOf(anchor)
          const targetIdx = ids.indexOf(id)
          const [lo, hi] =
            anchorIdx <= targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx]
          ids.slice(lo, hi + 1).forEach((pid) => next.add(pid))
        } else {
          next.clear()
          next.add(id)
        }
        return next
      })
    },
    [pages]
  )

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(pages.map((p) => p.id)))
  }, [pages])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // ───────────────────────
  // ページ削除
  // ───────────────────────
  const deleteSelected = useCallback(() => {
    if (selectedIds.size === 0) {
      setStatusMsg('削除するページを選択してください')
      return
    }
    pushHistory(pages)
    setPages((prev) => prev.filter((p) => !selectedIds.has(p.id)))
    setSelectedIds(new Set())
    setStatusMsg(`${selectedIds.size}ページを削除しました（Ctrl+Z で元に戻せます）`)
  }, [selectedIds, pages, pushHistory])

  // ───────────────────────
  // 回転
  // ───────────────────────
  const rotateSelected = useCallback(
    async (dir: 'left' | 'right') => {
      if (selectedIds.size === 0) {
        setStatusMsg('回転するページを選択してください')
        return
      }
      const delta = dir === 'left' ? 270 : 90  // 270 = -90 mod 360

      pushHistory(pages)

      const updatedPages = pages.map((p) => {
        if (!selectedIds.has(p.id)) return p
        return { ...p, rotation: (p.rotation + delta) % 360, thumbnail: null }
      })
      setPages(updatedPages)

      const targets = updatedPages.filter((p) => selectedIds.has(p.id))
      setStatusMsg(`${targets.length}ページを${dir === 'left' ? '左' : '右'}に回転しました`)
      generateThumbnails(targets, sourceFiles)
    },
    [selectedIds, pages, sourceFiles, pushHistory, generateThumbnails]
  )

  // ───────────────────────
  // 上へ / 下へ
  // ───────────────────────
  const moveUp = useCallback(() => {
    if (selectedIds.size === 0) return
    pushHistory(pages)
    setPages((prev) => {
      const arr = [...prev]
      const indices = arr
        .map((p, i) => (selectedIds.has(p.id) ? i : -1))
        .filter((i) => i >= 0)
      for (const idx of indices) {
        if (idx === 0) break
        ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
      }
      return arr
    })
  }, [selectedIds, pages, pushHistory])

  const moveDown = useCallback(() => {
    if (selectedIds.size === 0) return
    pushHistory(pages)
    setPages((prev) => {
      const arr = [...prev]
      const indices = arr
        .map((p, i) => (selectedIds.has(p.id) ? i : -1))
        .filter((i) => i >= 0)
        .reverse()
      for (const idx of indices) {
        if (idx === arr.length - 1) break
        ;[arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]]
      }
      return arr
    })
  }, [selectedIds, pages, pushHistory])

  // ───────────────────────
  // DnD 並び替え
  // ───────────────────────
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      pushHistory(pages)
      setPages((prev) => {
        const from = prev.findIndex((p) => p.id === active.id)
        const to = prev.findIndex((p) => p.id === over.id)
        return arrayMove(prev, from, to)
      })
    },
    [pages, pushHistory]
  )

  // ───────────────────────
  // 保存
  // ───────────────────────
  const saveAll = useCallback(async () => {
    if (pages.length === 0) {
      setStatusMsg('保存するページがありません')
      return
    }
    const filePath = await window.electronAPI.saveFile('結合済み.pdf')
    if (!filePath) return

    setIsLoading(true)
    setStatusMsg('保存中…')
    try {
      const data = await buildPDF(pages, sourceFiles)
      await window.electronAPI.writeFile(filePath, data.buffer as ArrayBuffer)
      setStatusMsg(`保存完了: ${filePath.split(/[\\/]/).pop()}`)
    } catch (err) {
      console.error(err)
      setStatusMsg('エラー: 保存に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [pages, sourceFiles])

  const saveSelected = useCallback(async () => {
    if (selectedIds.size === 0) {
      setStatusMsg('保存するページを選択してください')
      return
    }
    const filePath = await window.electronAPI.saveFile('選択ページ.pdf')
    if (!filePath) return

    setIsLoading(true)
    setStatusMsg('保存中…')
    try {
      const data = await buildSelectedPDF(pages, selectedIds, sourceFiles)
      await window.electronAPI.writeFile(filePath, data.buffer as ArrayBuffer)
      setStatusMsg(`${selectedIds.size}ページを保存完了: ${filePath.split(/[\\/]/).pop()}`)
    } catch (err) {
      console.error(err)
      setStatusMsg('エラー: 保存に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [selectedIds, pages, sourceFiles])

  // ───────────────────────
  // 他形式に変換
  // ───────────────────────
  const runConvert = useCallback(
    async (cfg: ConvertConfig) => {
      setConvertOpen(false)
      const targetPages =
        cfg.target === 'selected' ? pages.filter((p) => selectedIds.has(p.id)) : pages
      if (targetPages.length === 0) {
        setStatusMsg('変換するページがありません')
        return
      }

      setIsLoading(true)
      try {
        if (cfg.kind === 'image') {
          const folder = await window.electronAPI.selectFolder()
          if (!folder) { setIsLoading(false); return }
          setStatusMsg('画像を出力しています…')
          const result = await exportPagesAsImages(
            targetPages,
            sourceFiles,
            folder,
            { format: cfg.format, scale: cfg.scale, jpegQuality: cfg.jpegQuality },
            (done, total, name) => setStatusMsg(`出力中 (${done}/${total}): ${name}`)
          )
          setStatusMsg(
            `${result.saved}ファイルを ${folder} に保存しました` +
              (result.failed.length > 0 ? `（失敗: ${result.failed.length}）` : '')
          )
        } else {
          // text
          const filePath = await window.electronAPI.saveFile('抽出テキスト.txt')
          if (!filePath) { setIsLoading(false); return }
          setStatusMsg('テキストを抽出しています…')
          const text = await extractTextFromPages(targetPages, sourceFiles)
          const buf = new TextEncoder().encode(text)
          await window.electronAPI.writeToPath(filePath, buf.buffer as ArrayBuffer)
          setStatusMsg(`テキスト抽出完了: ${filePath.split(/[\\/]/).pop()}`)
        }
      } catch (err) {
        console.error(err)
        setStatusMsg('エラー: 変換に失敗しました')
      } finally {
        setIsLoading(false)
      }
    },
    [pages, selectedIds, sourceFiles]
  )

  // ───────────────────────
  // 拡大モーダル
  // ───────────────────────
  const openZoom = useCallback(() => {
    if (selectedIds.size === 0) {
      setStatusMsg('拡大表示するページを選択してください')
      return
    }
    setZoomOpen(true)
  }, [selectedIds])

  const zoomRotate = useCallback(
    async (pageId: string, delta: number) => {
      pushHistory(pages)
      const updated = pages.map((p) =>
        p.id === pageId ? { ...p, rotation: (p.rotation + delta + 360) % 360, thumbnail: null } : p
      )
      setPages(updated)
      setStatusMsg(`1ページを${delta < 0 ? '左' : '右'}に回転しました`)
      const target = updated.find((p) => p.id === pageId)
      if (target) generateThumbnails([target], sourceFiles)
    },
    [pages, sourceFiles, pushHistory, generateThumbnails]
  )

  const zoomDelete = useCallback(
    (pageId: string) => {
      pushHistory(pages)
      setPages((prev) => prev.filter((p) => p.id !== pageId))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(pageId)
        return next
      })
      setStatusMsg('1ページを削除しました（Ctrl+Z で元に戻せます）')
    },
    [pages, pushHistory]
  )

  // ───────────────────────
  // キーボードショートカット
  // ───────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 拡大・ヘルプモーダル表示中は各モーダルのハンドラが優先
      if (zoomOpen || helpOpen) return
      const ctrl = e.ctrlKey || e.metaKey
      if (e.key === 'F1' || (e.key === '?' && !ctrl)) {
        e.preventDefault()
        setHelpOpen(true)
        return
      }
      if (ctrl && e.key === 'z') undo()
      if (ctrl && e.key === 'a') {
        e.preventDefault()
        selectAll()
      }
      if (e.key === 'Delete' && selectedIds.size > 0) deleteSelected()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, selectAll, deleteSelected, selectedIds, zoomOpen, helpOpen])

  // ───────────────────────
  // クリーンアップ
  // ───────────────────────
  useEffect(() => {
    return () => {
      thumbAbortRef.current.cancelled = true
      sourceFiles.forEach((_, key) => evictDocumentCache(key))
    }
  }, [])

  // ───────────────────────
  // Render
  // ───────────────────────
  return (
    <div className="app" onDragOver={handleDragOver} onDrop={handleDrop}>
      <Toolbar
        hasPages={pages.length > 0}
        hasSelected={selectedIds.size > 0}
        isLoading={isLoading}
        canUndo={history.length > 0}
        onAddFiles={handleAddFiles}
        onDelete={deleteSelected}
        onRotateLeft={() => rotateSelected('left')}
        onRotateRight={() => rotateSelected('right')}
        onMoveUp={moveUp}
        onMoveDown={moveDown}
        onSaveAll={saveAll}
        onSaveSelected={saveSelected}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onUndo={undo}
        onZoom={openZoom}
        onHelp={() => setHelpOpen(true)}
        onConvert={() => setConvertOpen(true)}
        onAddImages={handleAddImages}
      />

      <div className="main-area">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
            <ThumbnailGrid
              pages={pages}
              selectedIds={selectedIds}
              onSelectPage={handleSelectPage}
              onDoubleClickPage={(id) => {
                if (!selectedIds.has(id)) {
                  setSelectedIds(new Set([id]))
                }
                setZoomOpen(true)
              }}
            />
          </SortableContext>
        </DndContext>
      </div>

      <StatusBar
        totalPages={pages.length}
        selectedCount={selectedIds.size}
        message={statusMsg}
        isLoading={isLoading}
      />

      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-box">
            <span className="loading-spin">⚙</span>
            <p>処理中です。しばらくお待ちください…</p>
          </div>
        </div>
      )}

      {zoomOpen && (
        <ZoomModal
          pages={pages}
          selectedIds={selectedIds}
          sourceFiles={sourceFiles}
          onClose={() => setZoomOpen(false)}
          onRotate={zoomRotate}
          onDelete={zoomDelete}
        />
      )}

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      {convertOpen && (
        <ConvertModal
          hasSelection={selectedIds.size > 0}
          totalPages={pages.length}
          selectedCount={selectedIds.size}
          onClose={() => setConvertOpen(false)}
          onSubmit={runConvert}
        />
      )}
    </div>
  )
}
