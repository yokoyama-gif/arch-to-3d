import React from 'react'

interface StatusBarProps {
  totalPages: number
  selectedCount: number
  message: string
  isLoading: boolean
}

export function StatusBar({ totalPages, selectedCount, message, isLoading }: StatusBarProps) {
  return (
    <div className="status-bar">
      <span className="status-pages">
        総ページ数: <strong>{totalPages}</strong>
      </span>
      <span className="status-selected">
        選択中: <strong>{selectedCount}</strong> ページ
      </span>
      <span className="status-msg">{isLoading ? '⏳ ' : ''}{message}</span>
    </div>
  )
}
