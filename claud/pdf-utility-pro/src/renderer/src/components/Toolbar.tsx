import React from 'react'

interface ToolbarProps {
  hasPages: boolean
  hasSelected: boolean
  isLoading: boolean
  canUndo: boolean
  onAddFiles: () => void
  onDelete: () => void
  onRotateLeft: () => void
  onRotateRight: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onSaveAll: () => void
  onSaveSelected: () => void
  onSelectAll: () => void
  onClearSelection: () => void
  onUndo: () => void
  onZoom: () => void
  onHelp: () => void
}

interface BtnProps {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'secondary'
}

function Btn({ icon, label, onClick, disabled, variant = 'secondary' }: BtnProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      <span className="btn-icon">{icon}</span>
      <span className="btn-label">{label}</span>
    </button>
  )
}

export function Toolbar({
  hasPages,
  hasSelected,
  isLoading,
  canUndo,
  onAddFiles,
  onDelete,
  onRotateLeft,
  onRotateRight,
  onMoveUp,
  onMoveDown,
  onSaveAll,
  onSaveSelected,
  onSelectAll,
  onClearSelection,
  onUndo,
  onZoom,
  onHelp
}: ToolbarProps) {
  const busy = isLoading

  return (
    <div className="toolbar">
      <span className="toolbar-title">PDF Utility Pro</span>

      <Btn icon="📁" label="ファイル追加" onClick={onAddFiles} disabled={busy} variant="primary" />

      <div className="toolbar-sep" />

      <Btn icon="🗑" label="削除" onClick={onDelete} disabled={!hasSelected || busy} variant="danger" />
      <Btn icon="↺" label="左回転" onClick={onRotateLeft} disabled={!hasSelected || busy} />
      <Btn icon="↻" label="右回転" onClick={onRotateRight} disabled={!hasSelected || busy} />

      <div className="toolbar-sep" />

      <Btn icon="▲" label="上へ" onClick={onMoveUp} disabled={!hasSelected || busy} />
      <Btn icon="▼" label="下へ" onClick={onMoveDown} disabled={!hasSelected || busy} />

      <div className="toolbar-sep" />

      <Btn icon="🔍" label="選択を拡大" onClick={onZoom} disabled={!hasSelected || busy} variant="primary" />

      <div className="toolbar-sep" />

      <Btn icon="☑" label="全選択" onClick={onSelectAll} disabled={!hasPages || busy} />
      <Btn icon="☐" label="選択解除" onClick={onClearSelection} disabled={!hasSelected || busy} />
      <Btn icon="↩" label="元に戻す" onClick={onUndo} disabled={!canUndo || busy} />

      <div className="toolbar-sep" />

      <Btn icon="💾" label="全体を保存" onClick={onSaveAll} disabled={!hasPages || busy} variant="success" />
      <Btn icon="📤" label="選択ページを保存" onClick={onSaveSelected} disabled={!hasSelected || busy} variant="warning" />

      <div style={{ flex: 1 }} />

      <Btn icon="❓" label="操作ヘルプ" onClick={onHelp} />
    </div>
  )
}
