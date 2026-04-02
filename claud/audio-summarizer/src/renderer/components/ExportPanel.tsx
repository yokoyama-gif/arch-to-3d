import { useState } from 'react'
import type { ProcessingResult, ExportFormat } from '../../shared/types'

interface Props {
  result: ProcessingResult
}

export default function ExportPanel({ result }: Props) {
  const [format, setFormat] = useState<ExportFormat>('md')
  const [includeTranscription, setIncludeTranscription] = useState(true)
  const [includeSummary, setIncludeSummary] = useState(true)
  const [includeBulletPoints, setIncludeBulletPoints] = useState(true)
  const [includeKeywords, setIncludeKeywords] = useState(true)
  const [saved, setSaved] = useState(false)

  const handleExport = async () => {
    const path = await window.electronAPI.exportResult(result, {
      format,
      includeTranscription,
      includeSummary,
      includeBulletPoints,
      includeKeywords
    })
    if (path) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  return (
    <div className="export-panel">
      <h3>保存設定</h3>
      <div className="export-options">
        <div className="export-format">
          <label>形式:</label>
          {(['txt', 'md', 'json'] as ExportFormat[]).map(f => (
            <button
              key={f}
              className={`format-btn ${format === f ? 'active' : ''}`}
              onClick={() => setFormat(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="export-includes">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeTranscription}
              onChange={e => setIncludeTranscription(e.target.checked)}
            />
            文字起こし
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeSummary}
              onChange={e => setIncludeSummary(e.target.checked)}
            />
            要約
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeBulletPoints}
              onChange={e => setIncludeBulletPoints(e.target.checked)}
            />
            箇条書き
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeKeywords}
              onChange={e => setIncludeKeywords(e.target.checked)}
            />
            キーワード
          </label>
        </div>

        <button
          className={`btn btn-primary btn-export ${saved ? 'saved' : ''}`}
          onClick={handleExport}
        >
          {saved ? '保存しました ✓' : '保存する'}
        </button>
      </div>
    </div>
  )
}
