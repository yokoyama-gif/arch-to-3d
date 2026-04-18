import { useState } from 'react'
import { useTournamentStore } from '../store/tournamentStore'
import { FEATURE_LABELS_JA, FEATURE_ORDER } from '../services/evaluationService'
import { Crown, ThumbsDown, ChevronDown, ChevronUp, Repeat2, BarChart2 } from 'lucide-react'

// スコアに応じた色
function scoreColor(score) {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 65) return 'text-amber-400'
  if (score >= 50) return 'text-orange-400'
  return 'text-red-400'
}
function scoreBg(score) {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 65) return 'bg-amber-500'
  if (score >= 50) return 'bg-orange-500'
  return 'bg-red-500'
}

// ── 部位スコアミニバー ─────────────────────────────────────
function FeatureBar({ label, score, note }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="w-10 text-slate-500 text-right shrink-0">{label}</span>
      <div className="flex-1 bg-slate-700 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${scoreBg(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`w-6 text-right font-bold shrink-0 ${scoreColor(score)}`}>{score}</span>
    </div>
  )
}

// ── 部位別フィードバックタグ ──────────────────────────────
const PART_KEYS = ['face_shape', 'eyes', 'nose', 'lips', 'hair', 'skin']
const PART_SHORT = { face_shape: '顔形', eyes: '目', nose: '鼻', lips: '口', hair: '髪', skin: '肌' }

function PartFeedbackTag({ partKey, value, onChange }) {
  const isGood = value === 'good'
  const isBad  = value === 'bad'
  return (
    <div className="flex items-center gap-0.5">
      <span className="text-[10px] text-slate-500">{PART_SHORT[partKey]}</span>
      <button
        onClick={() => onChange(partKey, 'good')}
        className={`text-[10px] px-1 rounded transition-all ${isGood ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-emerald-400'}`}
        title="似ている"
      >✅</button>
      <button
        onClick={() => onChange(partKey, 'bad')}
        className={`text-[10px] px-1 rounded transition-all ${isBad ? 'bg-red-700 text-white' : 'text-slate-600 hover:text-red-400'}`}
        title="違う"
      >❌</button>
    </div>
  )
}

// ── メインカード ──────────────────────────────────────────
export default function CandidateCard({ candidate }) {
  const { selectWinner, selectLoser, setFeedback, setPartFeedback } = useTournamentStore()
  const [promptExpanded, setPromptExpanded] = useState(false)
  const [scoresExpanded, setScoresExpanded] = useState(false)

  const { id, imageUrl, prompt, rankFlag, feedback, partFeedback = {}, evaluation, isCarriedOver } = candidate

  const isWinner = rankFlag === 'winner'
  const isLoser  = rankFlag === 'loser'

  let cardClass = 'relative flex flex-col bg-slate-800 rounded-xl overflow-hidden transition-all duration-300 '
  if (isWinner)      cardClass += 'ring-2 ring-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.4)]'
  else if (isLoser)  cardClass += 'ring-2 ring-red-500 opacity-55'
  else               cardClass += 'ring-1 ring-slate-700 hover:ring-slate-500'

  const overallScore = evaluation?.score ?? null

  return (
    <div className={cardClass}>
      {/* ── バッジ群 ── */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        {isWinner && (
          <span className="flex items-center gap-1 bg-amber-400 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
            <Crown size={9} /> 1位
          </span>
        )}
        {isLoser && (
          <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
            <ThumbsDown size={9} /> 最下位
          </span>
        )}
        {isCarriedOver && (
          <span className="flex items-center gap-1 bg-violet-700 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full shadow">
            <Repeat2 size={9} /> 継続
          </span>
        )}
      </div>

      {/* ── 類似度スコアバッジ（右上）── */}
      {overallScore !== null && (
        <div
          className={`absolute top-2 right-2 z-10 text-[11px] font-black px-2 py-0.5 rounded-full shadow cursor-pointer ${scoreColor(overallScore)} bg-slate-900/80 border border-slate-700`}
          onClick={() => setScoresExpanded(v => !v)}
          title="詳細スコアを表示"
        >
          {overallScore}%
        </div>
      )}

      {/* ── 画像 ── */}
      <div className="relative w-full bg-slate-900" style={{ paddingBottom: '120%' }}>
        <img
          src={imageUrl}
          alt={`Candidate ${id}`}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
        {isLoser && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-red-400 text-7xl font-black opacity-40 select-none">×</span>
          </div>
        )}
      </div>

      {/* ── 詳細スコアパネル（展開式）── */}
      {scoresExpanded && evaluation && (
        <div className="bg-slate-900/90 px-3 py-2 border-b border-slate-700 space-y-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
              <BarChart2 size={10} /> 部位別類似度
            </span>
            <button onClick={() => setScoresExpanded(false)} className="text-slate-600 hover:text-slate-400 text-[10px]">閉じる</button>
          </div>
          {FEATURE_ORDER.map(key => (
            evaluation.features?.[key] && (
              <FeatureBar
                key={key}
                label={FEATURE_LABELS_JA[key]}
                score={evaluation.features[key].score}
                note={evaluation.features[key].note}
              />
            )
          ))}
          {evaluation.improvements?.length > 0 && (
            <p className="text-[9px] text-red-400 mt-1">要改善: {evaluation.improvements.join(' · ')}</p>
          )}
          {evaluation.strengths?.length > 0 && (
            <p className="text-[9px] text-emerald-400">強み: {evaluation.strengths.join(' · ')}</p>
          )}
        </div>
      )}

      {/* ── プロンプト ── */}
      <div className="px-3 pt-2 pb-1">
        <button
          onClick={() => setPromptExpanded(v => !v)}
          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors w-full text-left"
        >
          <span className="font-semibold text-violet-400 text-[10px]">Prompt</span>
          <span className="ml-auto">{promptExpanded ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}</span>
        </button>
        <p className={`text-[10px] text-slate-400 mt-0.5 leading-relaxed font-mono ${promptExpanded ? '' : 'line-clamp-2'}`}>
          {prompt}
        </p>
      </div>

      {/* ── 部位別フィードバック ── */}
      <div className="px-3 py-1.5 border-t border-slate-700/50">
        <p className="text-[9px] text-slate-600 mb-1">部位評価（✅似てる / ❌違う）</p>
        <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
          {PART_KEYS.map(key => (
            <PartFeedbackTag
              key={key}
              partKey={key}
              value={partFeedback[key] ?? null}
              onChange={(k, v) => setPartFeedback(id, k, v)}
            />
          ))}
        </div>
      </div>

      {/* ── フリーテキストメモ ── */}
      <div className="px-3 pb-2">
        <textarea
          value={feedback}
          onChange={e => setFeedback(id, e.target.value)}
          placeholder="追記メモ（目が近い・輪郭が違う など）"
          rows={2}
          className="w-full text-[10px] bg-slate-700/70 border border-slate-600/50 rounded-lg p-2 text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-colors"
        />
      </div>

      {/* ── 1位・最下位ボタン ── */}
      <div className="flex gap-2 px-3 pb-3">
        <button
          onClick={() => selectWinner(id)}
          className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-bold py-1.5 rounded-lg transition-all duration-200 ${
            isWinner
              ? 'bg-amber-400 text-slate-900 ring-2 ring-amber-300 shadow'
              : 'bg-slate-700 hover:bg-amber-500 hover:text-slate-900 text-slate-400'
          }`}
        >
          <Crown size={11} />{isWinner ? '1位 ✓' : '1位'}
        </button>
        <button
          onClick={() => selectLoser(id)}
          className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-bold py-1.5 rounded-lg transition-all duration-200 ${
            isLoser
              ? 'bg-red-600 text-white ring-2 ring-red-400 shadow'
              : 'bg-slate-700 hover:bg-red-600 hover:text-white text-slate-500'
          }`}
        >
          <ThumbsDown size={11} />{isLoser ? '最下位 ✓' : '最下位'}
        </button>
      </div>
    </div>
  )
}
