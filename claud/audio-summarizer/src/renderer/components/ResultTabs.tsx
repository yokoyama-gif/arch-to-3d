import { useState } from 'react'
import type { ProcessingResult } from '../../shared/types'

interface Props {
  result: ProcessingResult
}

type TabId = 'transcription' | 'summary' | 'bullets' | 'keywords'

const tabs: { id: TabId; label: string }[] = [
  { id: 'transcription', label: '文字起こし' },
  { id: 'summary', label: '要約' },
  { id: 'bullets', label: '箇条書き' },
  { id: 'keywords', label: 'キーワード' }
]

type SummaryLevel = 'short' | 'standard' | 'detailed'

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}

export default function ResultTabs({ result }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('transcription')
  const [summaryLevel, setSummaryLevel] = useState<SummaryLevel>('standard')
  const [copied, setCopied] = useState(false)

  const handleCopy = (text: string) => {
    copyToClipboard(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getCurrentText = (): string => {
    switch (activeTab) {
      case 'transcription':
        return result.transcription.fullText
      case 'summary':
        return result.summary[summaryLevel]
      case 'bullets':
        return result.bulletPoints.map(p => `・${p}`).join('\n')
      case 'keywords':
        return result.keywords.map(k => k.word).join('、')
    }
  }

  return (
    <div className="result-tabs">
      <div className="tabs-header">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <button
          className={`btn btn-copy ${copied ? 'copied' : ''}`}
          onClick={() => handleCopy(getCurrentText())}
        >
          {copied ? 'コピーしました' : 'コピー'}
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'transcription' && (
          <div className="transcription-content">
            {result.transcription.segments.length > 1 ? (
              result.transcription.segments.map((seg, i) => (
                <div key={i} className="segment">
                  <span className="segment-time">
                    {formatTime(seg.start)}
                  </span>
                  <span className="segment-text">{seg.text}</span>
                </div>
              ))
            ) : (
              <p className="full-text">{result.transcription.fullText}</p>
            )}
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="summary-content">
            <div className="summary-level-selector">
              <button
                className={`level-btn ${summaryLevel === 'short' ? 'active' : ''}`}
                onClick={() => setSummaryLevel('short')}
              >
                短い
              </button>
              <button
                className={`level-btn ${summaryLevel === 'standard' ? 'active' : ''}`}
                onClick={() => setSummaryLevel('standard')}
              >
                標準
              </button>
              <button
                className={`level-btn ${summaryLevel === 'detailed' ? 'active' : ''}`}
                onClick={() => setSummaryLevel('detailed')}
              >
                詳細
              </button>
            </div>
            <p className="summary-text">{result.summary[summaryLevel]}</p>
          </div>
        )}

        {activeTab === 'bullets' && (
          <ul className="bullets-content">
            {result.bulletPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        )}

        {activeTab === 'keywords' && (
          <div className="keywords-content">
            {result.keywords.map((kw, i) => (
              <span key={i} className="keyword-tag">
                {kw.word}
                <span className="keyword-score">
                  {(kw.score * 100).toFixed(0)}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
