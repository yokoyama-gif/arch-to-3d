import { useState, useCallback, DragEvent } from 'react'
import { SUPPORTED_EXTENSIONS } from '../../shared/types'

interface Props {
  onFileSelect: (path?: string) => void
  error: string | null
}

export default function FileDropZone({ onFileSelect, error }: Props) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        onFileSelect((file as any).path)
      }
    }
  }, [onFileSelect])

  return (
    <div className="file-drop-container">
      <div
        className={`file-drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="drop-icon">📁</div>
        <p className="drop-text">
          ファイルをここにドラッグ＆ドロップ
        </p>
        <p className="drop-subtext">
          または
        </p>
        <button
          className="btn btn-primary"
          onClick={() => onFileSelect()}
        >
          ファイルを選択
        </button>
        <p className="drop-formats">
          対応形式: {SUPPORTED_EXTENSIONS.join(', ')}
        </p>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
