import { useState, useEffect, useCallback } from 'react'
import type { ProcessingResult, ProgressUpdate, ProcessingPhase } from '../shared/types'
import FileDropZone from './components/FileDropZone'
import ProcessingView from './components/ProcessingView'
import ResultTabs from './components/ResultTabs'
import ExportPanel from './components/ExportPanel'

type AppView = 'select' | 'processing' | 'result'

export default function App() {
  const [view, setView] = useState<AppView>('select')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [progress, setProgress] = useState<ProgressUpdate>({
    phase: 'idle',
    progress: 0,
    message: ''
  })
  const [result, setResult] = useState<ProcessingResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = window.electronAPI.onProgress((update: ProgressUpdate) => {
      setProgress(update)
      if (update.phase === 'error') {
        setError(update.message)
        setView('select')
      }
    })
    return unsubscribe
  }, [])

  const handleFileSelect = useCallback(async (path?: string) => {
    let selected = path
    if (!selected) {
      selected = await window.electronAPI.selectFile() ?? undefined
    }
    if (!selected) return

    setFilePath(selected)
    setFileName(selected.split(/[/\\]/).pop() || selected)
    setError(null)
    setView('processing')

    try {
      const res = await window.electronAPI.processFile(selected)
      setResult(res)
      setView('result')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '処理中にエラーが発生しました'
      setError(msg)
      setView('select')
    }
  }, [])

  const handleCancel = useCallback(() => {
    window.electronAPI.cancelProcessing()
    setView('select')
    setProgress({ phase: 'idle', progress: 0, message: '' })
  }, [])

  const handleBack = useCallback(() => {
    setView('select')
    setResult(null)
    setFilePath(null)
    setError(null)
    setProgress({ phase: 'idle', progress: 0, message: '' })
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>音声まとめ</h1>
        <p className="app-subtitle">動画・音声ファイルを文字起こし＆要約</p>
      </header>

      <main className="app-main">
        {view === 'select' && (
          <FileDropZone
            onFileSelect={handleFileSelect}
            error={error}
          />
        )}

        {view === 'processing' && (
          <ProcessingView
            fileName={fileName}
            progress={progress}
            onCancel={handleCancel}
          />
        )}

        {view === 'result' && result && (
          <>
            <div className="result-header">
              <button className="btn btn-secondary" onClick={handleBack}>
                ← 別のファイルを処理
              </button>
              <span className="result-filename">{fileName}</span>
            </div>
            <ResultTabs result={result} />
            <ExportPanel result={result} />
          </>
        )}
      </main>
    </div>
  )
}
