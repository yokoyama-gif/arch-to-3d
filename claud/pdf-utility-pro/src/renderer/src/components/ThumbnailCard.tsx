import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { PageItem } from '../types'

interface ThumbnailCardProps {
  page: PageItem
  index: number
  isSelected: boolean
  onClick: (id: string, e: React.MouseEvent) => void
  onDoubleClick: (id: string) => void
}

export function ThumbnailCard({ page, index, isSelected, onClick, onDoubleClick }: ThumbnailCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 1000 : undefined
  }

  const shortName =
    page.sourceFileName.length > 18
      ? '…' + page.sourceFileName.slice(-15)
      : page.sourceFileName

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`thumbnail-card${isSelected ? ' selected' : ''}${isDragging ? ' dragging' : ''}`}
      onClick={(e) => onClick(page.id, e)}
      onDoubleClick={() => onDoubleClick(page.id)}
      {...attributes}
      {...listeners}
    >
      <div className="thumb-img-wrap">
        {page.thumbnail ? (
          <img
            src={page.thumbnail}
            alt={`ページ ${index + 1}`}
            className="thumb-img"
            draggable={false}
          />
        ) : (
          <div className="thumb-loading">
            <span className="thumb-spinner">⏳</span>
            <span>生成中</span>
          </div>
        )}
      </div>
      <div className="thumb-meta">
        <span className="thumb-page-num">p.{index + 1}</span>
        {page.rotation !== 0 && (
          <span className="thumb-rotation-badge">{page.rotation}°</span>
        )}
        <span className="thumb-filename" title={page.sourceFileName}>
          {shortName}
        </span>
      </div>
    </div>
  )
}
