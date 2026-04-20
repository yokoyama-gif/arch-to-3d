import React, { useState, useEffect } from 'react'
import type { ImageFormat } from '../features/pdf/pdfConverter'

export type ConvertKind = 'image' | 'text'
export type ConvertTarget = 'all' | 'selected'

export interface ConvertConfig {
  kind: ConvertKind
  target: ConvertTarget
  format: ImageFormat
  scale: number
  jpegQuality: number
}

interface ConvertModalProps {
  hasSelection: boolean
  totalPages: number
  selectedCount: number
  onClose: () => void
  onSubmit: (config: ConvertConfig) => void
}

export function ConvertModal({
  hasSelection,
  totalPages,
  selectedCount,
  onClose,
  onSubmit
}: ConvertModalProps) {
  const [kind, setKind] = useState<ConvertKind>('image')
  const [target, setTarget] = useState<ConvertTarget>(hasSelection ? 'selected' : 'all')
  const [format, setFormat] = useState<ImageFormat>('png')
  const [scale, setScale] = useState<number>(2)
  const [jpegQuality, setJpegQuality] = useState<number>(0.9)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter') submit()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const submit = () => {
    onSubmit({ kind, target, format, scale, jpegQuality })
  }

  const outCount = target === 'selected' ? selectedCount : totalPages

  return (
    <div className="convert-modal show" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="convert-box">
        <button className="help-close" onClick={onClose} title="閉じる (Esc)">✕</button>
        <div className="convert-title">🔄 他の形式に変換</div>

        <div className="convert-section">
          <div className="convert-label">変換する形式</div>
          <div className="convert-options">
            <label className={`convert-option ${kind === 'image' ? 'active' : ''}`}>
              <input type="radio" name="kind" value="image" checked={kind === 'image'}
                     onChange={() => setKind('image')} />
              <span className="convert-option-icon">🖼️</span>
              <div>
                <div className="convert-option-title">画像（PNG / JPEG）</div>
                <div className="convert-option-desc">各ページを別々の画像ファイルとしてフォルダに保存</div>
              </div>
            </label>
            <label className={`convert-option ${kind === 'text' ? 'active' : ''}`}>
              <input type="radio" name="kind" value="text" checked={kind === 'text'}
                     onChange={() => setKind('text')} />
              <span className="convert-option-icon">📝</span>
              <div>
                <div className="convert-option-title">テキスト（.txt）</div>
                <div className="convert-option-desc">全ページのテキストを1つの .txt ファイルに抽出</div>
              </div>
            </label>
          </div>
        </div>

        <div className="convert-section">
          <div className="convert-label">対象</div>
          <div className="convert-radio-row">
            <label className={`convert-pill ${target === 'all' ? 'active' : ''}`}>
              <input type="radio" name="target" value="all" checked={target === 'all'}
                     onChange={() => setTarget('all')} />
              全ページ（{totalPages}ページ）
            </label>
            <label className={`convert-pill ${target === 'selected' ? 'active' : ''} ${hasSelection ? '' : 'convert-pill-disabled'}`}>
              <input type="radio" name="target" value="selected" checked={target === 'selected'}
                     disabled={!hasSelection}
                     onChange={() => setTarget('selected')} />
              選択ページ（{selectedCount}ページ）
            </label>
          </div>
        </div>

        {kind === 'image' && (
          <>
            <div className="convert-section">
              <div className="convert-label">形式</div>
              <div className="convert-radio-row">
                <label className={`convert-pill ${format === 'png' ? 'active' : ''}`}>
                  <input type="radio" name="format" value="png" checked={format === 'png'}
                         onChange={() => setFormat('png')} />
                  PNG（高品質・透明対応）
                </label>
                <label className={`convert-pill ${format === 'jpeg' ? 'active' : ''}`}>
                  <input type="radio" name="format" value="jpeg" checked={format === 'jpeg'}
                         onChange={() => setFormat('jpeg')} />
                  JPEG（ファイルサイズ小）
                </label>
              </div>
            </div>

            <div className="convert-section">
              <div className="convert-label">解像度（倍率）</div>
              <div className="convert-radio-row">
                {[
                  { v: 1.5, label: '標準', desc: '1.5x' },
                  { v: 2, label: '高', desc: '2x（推奨）' },
                  { v: 3, label: '最高', desc: '3x' }
                ].map(({ v, label, desc }) => (
                  <label key={v} className={`convert-pill ${scale === v ? 'active' : ''}`}>
                    <input type="radio" name="scale" value={v} checked={scale === v}
                           onChange={() => setScale(v)} />
                    {label}（{desc}）
                  </label>
                ))}
              </div>
            </div>

            {format === 'jpeg' && (
              <div className="convert-section">
                <div className="convert-label">JPEG 品質: {Math.round(jpegQuality * 100)}%</div>
                <input type="range" min={0.5} max={1} step={0.05} value={jpegQuality}
                       onChange={(e) => setJpegQuality(parseFloat(e.target.value))}
                       className="convert-range" />
              </div>
            )}
          </>
        )}

        <div className="convert-info">
          {kind === 'image'
            ? <>{outCount} 個の{format.toUpperCase()}ファイルが生成されます。次にフォルダを選択してください。</>
            : <>1 つのテキストファイルに {outCount} ページ分のテキストが抽出されます。</>}
        </div>

        <div className="convert-actions">
          <button className="convert-btn convert-btn-secondary" onClick={onClose}>キャンセル</button>
          <button className="convert-btn convert-btn-primary" onClick={submit} disabled={outCount === 0}>
            {kind === 'image' ? '📁 フォルダを選んで出力' : '💾 テキストを保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
