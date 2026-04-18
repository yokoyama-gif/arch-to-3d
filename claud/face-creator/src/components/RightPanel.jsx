import { useTournamentStore, PHASE } from '../store/tournamentStore'
import CandidateCard from './CandidateCard'
import RoundSummary from './RoundSummary'
import { Sparkles, RotateCcw, Loader2, Trophy } from 'lucide-react'

const COUNT_OPTIONS = [2, 4, 6, 8]

export default function RightPanel() {
  const {
    phase, candidates, candidateCount, setCandidateCount,
    startGeneration, isGenerating, generationProgress, finalWinner, reset,
    referenceImage, round,
  } = useTournamentStore()

  // カードのグリッド列数
  const cols = candidateCount <= 2 ? 'grid-cols-2' :
               candidateCount <= 4 ? 'grid-cols-2 md:grid-cols-2' :
               'grid-cols-2 md:grid-cols-3'

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 pl-3 gap-4">

      {/* ── 生成コントロール（スティッキー） ── */}
      <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-sm pb-3 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          {/* 生成枚数 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 whitespace-nowrap">生成枚数</span>
            <div className="flex gap-1">
              {COUNT_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => setCandidateCount(n)}
                  disabled={phase === PHASE.VOTING || isGenerating}
                  className={`w-9 h-9 rounded-lg text-sm font-bold transition-all duration-200
                    ${candidateCount === n
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-500/30'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* 作成ボタン（ラウンド1のみ表示） */}
          {(phase === PHASE.READY || phase === PHASE.SETUP) && (
            <button
              onClick={startGeneration}
              disabled={isGenerating || !referenceImage}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold px-5 py-2.5 rounded-xl transition-all duration-200 text-sm shadow-lg hover:shadow-violet-500/20"
            >
              {isGenerating
                ? <><Loader2 size={15} className="animate-spin" /> 生成中…</>
                : <><Sparkles size={15} /> 顔を生成する</>
              }
            </button>
          )}

          {/* リセット */}
          {(phase === PHASE.VOTING || phase === PHASE.COMPLETE) && (
            <button
              onClick={reset}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors ml-auto"
            >
              <RotateCcw size={13} /> リセット
            </button>
          )}
        </div>

        {/* 進行バー */}
        {isGenerating && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>生成中… {generationProgress}%</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${generationProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── セットアップ状態 ── */}
      {phase === PHASE.SETUP && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 max-w-sm">
            <div className="text-4xl">👈</div>
            <p className="text-slate-300 font-semibold">左に参照画像をアップロードしてください</p>
            <p className="text-sm text-slate-500">目標とする女性の顔画像を貼ると、<br/>そこに近づくためのプロンプト進化が始まります</p>
          </div>
        </div>
      )}

      {/* ── 準備完了状態 ── */}
      {phase === PHASE.READY && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 max-w-sm">
            <Sparkles size={40} className="mx-auto text-violet-400" />
            <p className="text-slate-200 font-bold text-lg">準備完了</p>
            <p className="text-sm text-slate-400">生成枚数を選んで「顔を生成する」を押してください</p>
            <p className="text-xs text-slate-600 mt-2">
              {/* APIキーなしでも動作確認できます */}
              Gemini APIキー未入力の場合はSVGモック画像で動作確認できます
            </p>
          </div>
        </div>
      )}

      {/* ── 生成中アニメーション ── */}
      {phase === PHASE.GENERATING && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="flex gap-2 justify-center">
              {Array.from({ length: candidateCount }).map((_, i) => (
                <div
                  key={i}
                  className="w-12 h-16 rounded-lg shimmer"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <p className="text-slate-400 text-sm">プロンプト生成 → 画像生成中…</p>
          </div>
        </div>
      )}

      {/* ── 候補一覧 ── */}
      {phase === PHASE.VOTING && candidates.length > 0 && (
        <>
          <div className="mb-1">
            <h2 className="text-sm font-bold text-slate-300">
              Round {round} — 候補 {candidates.length} 枚
            </h2>
            <p className="text-xs text-slate-500">1位と最下位を選び、メモを書いて「次ラウンドへ」を押してください</p>
          </div>
          <div className={`grid ${cols} gap-4`}>
            {candidates.map(c => (
              <CandidateCard key={c.id} candidate={c} />
            ))}
          </div>
          <RoundSummary />
        </>
      )}

      {/* ── 完了画面 ── */}
      {phase === PHASE.COMPLETE && finalWinner && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center py-8">
          <Trophy size={48} className="text-amber-400" />
          <div>
            <h2 className="text-2xl font-black text-amber-400 mb-1">トーナメント完了！</h2>
            <p className="text-slate-400 text-sm">最終勝者のプロンプトと画像が確定しました</p>
          </div>
          <img
            src={finalWinner.imageUrl}
            alt="Final winner"
            className="max-w-xs w-full rounded-2xl border-2 border-amber-500/60 shadow-2xl shadow-amber-500/20"
          />
          <div className="max-w-md bg-slate-800 rounded-xl p-4 text-left">
            <p className="text-xs font-bold text-amber-400 mb-2">最終プロンプト</p>
            <p className="text-xs text-slate-300 font-mono leading-relaxed">{finalWinner.prompt}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                navigator.clipboard.writeText(finalWinner.prompt)
              }}
              className="btn-secondary text-sm"
            >
              プロンプトをコピー
            </button>
            <button onClick={reset} className="btn-primary text-sm">
              新しいトーナメントを開始
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
