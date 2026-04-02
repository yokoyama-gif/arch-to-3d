import type { ProgressUpdate } from '../../shared/types'

interface Props {
  fileName: string
  progress: ProgressUpdate
  onCancel: () => void
}

const phaseLabels: Record<string, string> = {
  'idle': '待機中',
  'extracting-audio': '音声を抽出中',
  'loading-model': 'AIモデルを準備中',
  'transcribing': '文字起こし中',
  'analyzing': 'テキストを分析中',
  'done': '完了',
  'error': 'エラー'
}

export default function ProcessingView({ fileName, progress, onCancel }: Props) {
  const phaseLabel = phaseLabels[progress.phase] || progress.phase

  // 全体の進捗を計算（各フェーズに重み付け）
  const overallProgress = (() => {
    switch (progress.phase) {
      case 'extracting-audio': return progress.progress * 0.15
      case 'loading-model': return 15 + progress.progress * 0.15
      case 'transcribing': return 30 + progress.progress * 0.5
      case 'analyzing': return 80 + progress.progress * 0.2
      case 'done': return 100
      default: return 0
    }
  })()

  return (
    <div className="processing-view">
      <div className="processing-card">
        <div className="processing-filename">{fileName}</div>

        <div className="processing-phase">
          <span className="spinner" />
          <span>{phaseLabel}</span>
        </div>

        <div className="progress-bar-container">
          <div
            className="progress-bar"
            style={{ width: `${Math.min(100, overallProgress)}%` }}
          />
        </div>

        <p className="processing-message">{progress.message}</p>

        <button className="btn btn-secondary" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </div>
  )
}
