import React, { useEffect, useState, useCallback, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PageItem, SourceFile } from '../types'

interface ZoomModalProps {
  pages: PageItem[]
  selectedIds: Set<string>
  sourceFiles: Map<string, SourceFile>
  onClose: () => void
  onRotate: (pageId: string, delta: number) => void
  onDelete: (pageId: string) => void
}

export function ZoomModal({
  pages,
  selectedIds,
  sourceFiles,
  onClose,
  onRotate,
  onDelete
}: ZoomModalProps) {
  const zoomList = pages.filter((p) => selectedIds.has(p.id))
  const [idx, setIdx] = useState(0)
  const [imgSrc, setImgSrc] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const renderTokenRef = useRef(0)

  const current = zoomList[idx]
  const totalIdxInAll = current ? pages.findIndex((p) => p.id === current.id) : -1

  const renderPage = useCallback(async () => {
    if (!current) return
    const sf = sourceFiles.get(current.sourceFileId)
    if (!sf) return

    const myToken = ++renderTokenRef.current
    setLoading(true)

    try {
      const doc = await pdfjsLib.getDocument({ data: sf.data.slice() }).promise
      const page = await doc.getPage(current.pageIndex + 1)
      const vp0 = page.getViewport({ scale: 1, rotation: 0 })
      const dpr = window.devicePixelRatio || 1
      const maxW = window.innerWidth - 16
      const maxH = window.innerHeight - 16
      const scale = Math.min(maxW / vp0.width, maxH / vp0.height) * dpr
      const vp = page.getViewport({ scale, rotation: current.rotation })

      const canvas = document.createElement('canvas')
      canvas.width = Math.round(vp.width)
      canvas.height = Math.round(vp.height)
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise

      if (myToken !== renderTokenRef.current) return  // 古いレンダリング結果は破棄
      setImgSrc(canvas.toDataURL('image/jpeg', 0.92))
    } catch (err) {
      console.error('拡大表示エラー:', err)
    } finally {
      if (myToken === renderTokenRef.current) setLoading(false)
    }
  }, [current, sourceFiles])

  useEffect(() => {
    renderPage()
  }, [renderPage])

  // idxが範囲外になったら補正
  useEffect(() => {
    if (zoomList.length === 0) {
      onClose()
      return
    }
    if (idx >= zoomList.length) setIdx(zoomList.length - 1)
  }, [zoomList.length, idx, onClose])

  const nav = (delta: number) => {
    setIdx((i) => Math.max(0, Math.min(zoomList.length - 1, i + delta)))
  }

  const handleRotate = (delta: number) => {
    if (!current) return
    onRotate(current.id, delta)
  }

  const handleDelete = () => {
    if (!current) return
    onDelete(current.id)
  }

  // キーボード操作
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowLeft')  { nav(-1); return }
      if (e.key === 'ArrowRight') { nav(1); return }
      if (e.key === 'l' || e.key === 'L') { handleRotate(-90); return }
      if (e.key === 'r' || e.key === 'R') { handleRotate(90); return }
      if (e.key === 'Delete') { handleDelete(); return }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, current])

  if (!current) return null

  return (
    <div className="zoom-modal show">
      <div className="zoom-header">
        <span className="zoom-title">
          {current.sourceFileName}　(p.{totalIdxInAll + 1}
          {current.rotation !== 0 ? `, ${current.rotation}°回転` : ''})
        </span>
        <span className="zoom-page-info">
          {idx + 1} / {zoomList.length}
        </span>
        <button className="zoom-btn" onClick={() => handleRotate(-90)} title="左回転 (L)">
          <span>↺</span>左回転
        </button>
        <button className="zoom-btn" onClick={() => handleRotate(90)} title="右回転 (R)">
          <span>↻</span>右回転
        </button>
        <button className="zoom-btn zoom-btn-danger" onClick={handleDelete} title="削除 (Delete)">
          <span>🗑</span>削除
        </button>
        <button className="zoom-btn" onClick={onClose} title="閉じる (Esc)">
          <span>✕</span>閉じる
        </button>
      </div>

      <div className="zoom-viewer">
        <button
          className="zoom-nav-btn zoom-nav-prev"
          onClick={() => nav(-1)}
          disabled={idx === 0}
          title="前のページ (←)"
        >
          ‹
        </button>

        <div className="zoom-canvas-wrap">
          {loading && !imgSrc ? (
            <div style={{ padding: '60px', color: '#888' }}>読み込み中…</div>
          ) : (
            <img src={imgSrc} alt="preview" />
          )}
        </div>

        <button
          className="zoom-nav-btn zoom-nav-next"
          onClick={() => nav(1)}
          disabled={idx === zoomList.length - 1}
          title="次のページ (→)"
        >
          ›
        </button>
      </div>

      <div className="zoom-footer">
        <span><kbd>←</kbd><kbd>→</kbd> 移動</span>
        <span><kbd>L</kbd> 左回転</span>
        <span><kbd>R</kbd> 右回転</span>
        <span><kbd>Del</kbd> 削除</span>
        <span><kbd>Esc</kbd> 閉じる</span>
      </div>
    </div>
  )
}
