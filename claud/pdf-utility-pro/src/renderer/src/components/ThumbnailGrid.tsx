import React from 'react'
import { ThumbnailCard } from './ThumbnailCard'
import type { PageItem } from '../types'

interface ThumbnailGridProps {
  pages: PageItem[]
  selectedIds: Set<string>
  onSelectPage: (id: string, e: React.MouseEvent) => void
  onDoubleClickPage: (id: string) => void
}

export function ThumbnailGrid({ pages, selectedIds, onSelectPage, onDoubleClickPage }: ThumbnailGridProps) {
  if (pages.length === 0) {
    return (
      <div className="thumbnail-grid">
        <div className="empty-state">
          <div className="empty-icon">📂</div>
          <div className="empty-title">PDFファイルをここにドラッグ＆ドロップ</div>
          <div className="empty-subtitle">
            または上部の「ファイル追加」ボタンをクリックしてください。
            <br />
            複数ファイルを一度に追加できます。
            <br />
            <br />
            <span className="empty-hint">
              <span className="help-mouse">Ctrl+クリック</span> 複数選択 ／ <span className="help-mouse">Shift+クリック</span> 範囲選択<br />
              <span className="help-mouse">ダブルクリック</span> 拡大表示 ／ <span className="help-kbd">F1</span> で操作ヘルプ
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="thumbnail-grid">
      <div className="thumbnail-grid-inner">
        {pages.map((page, index) => (
          <ThumbnailCard
            key={page.id}
            page={page}
            index={index}
            isSelected={selectedIds.has(page.id)}
            onClick={onSelectPage}
            onDoubleClick={onDoubleClickPage}
          />
        ))}
      </div>
    </div>
  )
}
