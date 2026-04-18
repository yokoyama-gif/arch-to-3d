import { useTournamentStore, PHASE } from '../store/tournamentStore'
import { Crown, ThumbsDown, ArrowRight, Trophy, RotateCcw, BarChart2 } from 'lucide-react'
import { FEATURE_LABELS_JA, FEATURE_ORDER } from '../services/evaluationService'

function MiniScoreGrid({ evaluation }) {
  if (!evaluation?.features) return null
  return (
    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
      {FEATURE_ORDER.map(key => {
        const f = evaluation.features[key]
        if (!f) return null
        const color = f.score >= 80 ? 'text-emerald-400' : f.score >= 65 ? 'text-amber-400' : 'text-red-400'
        return (
          <div key={key} className="flex items-center gap-1 text-[9px]">
            <span className="text-slate-600 w-8">{FEATURE_LABELS_JA[key]}</span>
            <div className="flex-1 bg-slate-700 rounded-full h-1 overflow-hidden">
              <div
                className={`h-full rounded-full ${f.score >= 80 ? 'bg-emerald-500' : f.score >= 65 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${f.score}%` }}
              />
            </div>
            <span className={`${color} font-bold w-4 text-right`}>{f.score}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function RoundSummary() {
  const {
    candidates, phase, round, roundInsight,
    nextRound, saveFinalWinner, reset, isGenerating, isEvaluating, error, clearError,
  } = useTournamentStore()

  if (phase !== PHASE.VOTING) return null

  const winner = candidates.find(c => c.rankFlag === 'winner')
  const loser  = candidates.find(c => c.rankFlag === 'loser')

  // 全候補のスコア一覧（評価済みのもの）
  const scoredCount = candidates.filter(c => c.evaluation !== null).length

  return (
    <div className="mt-6 border-t border-slate-700 pt-6 space-y-4">

      {/* エラー */}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-red-300 text-sm">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-200 text-xs ml-4">閉じる</button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <h3 className="text-slate-300 font-bold text-sm tracking-widest uppercase">
          ■ ラウンド {round} サマリー
        </h3>
        {isEvaluating && (
          <span className="text-[10px] text-violet-400 flex items-center gap-1">
            <BarChart2 size={10} className="animate-pulse" /> AI評価中…
          </span>
        )}
        {!isEvaluating && scoredCount > 0 && (
          <span className="text-[10px] text-slate-500">{scoredCount}/{candidates.length} 件評価済み</span>
        )}
      </div>

      {/* 勝者・敗者プレビュー */}
      <div className="grid grid-cols-2 gap-4">
        {/* 勝者 */}
        <div className={`rounded-xl p-3 ${winner ? 'bg-amber-900/20 border border-amber-600/40' : 'bg-slate-800 border border-slate-700'}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <Crown size={13} className="text-amber-400" />
            <span className="text-[11px] font-bold text-amber-400">今ラウンド 1位</span>
            {winner?.evaluation && (
              <span className="ml-auto text-[11px] font-black text-amber-300">{winner.evaluation.score}%</span>
            )}
          </div>
          {winner ? (
            <>
              <img src={winner.imageUrl} alt="winner" className="w-full aspect-[3/4] object-cover rounded-lg mb-2"/>
              {winner.evaluation && <MiniScoreGrid evaluation={winner.evaluation} />}
              <p className="text-[9px] text-slate-300 font-mono mt-2 line-clamp-2">{winner.prompt.slice(0, 70)}…</p>
              {winner.feedback && <p className="text-[10px] text-amber-300 mt-1 italic">「{winner.feedback}」</p>}
            </>
          ) : (
            <p className="text-xs text-slate-500 italic">未選択</p>
          )}
        </div>

        {/* 敗者 */}
        <div className={`rounded-xl p-3 ${loser ? 'bg-red-900/20 border border-red-700/40' : 'bg-slate-800 border border-slate-700'}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <ThumbsDown size={13} className="text-red-400" />
            <span className="text-[11px] font-bold text-red-400">今ラウンド 最下位</span>
            {loser?.evaluation && (
              <span className="ml-auto text-[11px] font-black text-red-300">{loser.evaluation.score}%</span>
            )}
          </div>
          {loser ? (
            <>
              <img src={loser.imageUrl} alt="loser" className="w-full aspect-[3/4] object-cover rounded-lg mb-2 opacity-60"/>
              {loser.evaluation && <MiniScoreGrid evaluation={loser.evaluation} />}
              {loser.feedback && <p className="text-[10px] text-red-300 mt-1 italic">「{loser.feedback}」</p>}
            </>
          ) : (
            <p className="text-[10px] text-slate-500 italic">未選択（任意）</p>
          )}
        </div>
      </div>

      {/* AIインサイト */}
      {roundInsight && round > 1 && (
        <div className="bg-violet-900/20 border border-violet-700/40 rounded-xl p-4">
          <p className="text-[10px] font-bold text-violet-400 mb-1 flex items-center gap-1">
            <BarChart2 size={10} /> AI 改善ポイント
          </p>
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{roundInsight}</p>
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          onClick={nextRound}
          disabled={!winner || isGenerating}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold px-5 py-2.5 rounded-xl transition-all text-sm shadow-lg hover:shadow-violet-500/25"
        >
          <ArrowRight size={15} />
          次ラウンドへ（勝者を残して再生成）
        </button>

        <button
          onClick={saveFinalWinner}
          disabled={!winner || isGenerating}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-bold px-5 py-2.5 rounded-xl transition-all text-sm shadow-lg"
        >
          <Trophy size={15} />
          これで決定（最終保存）
        </button>

        <button
          onClick={reset}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold px-4 py-2.5 rounded-xl transition-all text-sm ml-auto"
        >
          <RotateCcw size={13} />リセット
        </button>
      </div>

      <p className="text-[10px] text-slate-600">
        ※「次ラウンドへ」: 1位の画像を引き継ぎ、部位別フィードバック + AI評価スコアをもとに改善プロンプトで再生成
      </p>
    </div>
  )
}
