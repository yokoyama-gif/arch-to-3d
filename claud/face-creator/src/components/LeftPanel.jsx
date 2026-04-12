import { useRef } from 'react'
import { useTournamentStore, PHASE } from '../store/tournamentStore'
import { FEATURE_LABELS_JA, FEATURE_ORDER } from '../services/evaluationService'
import { Upload, ImageIcon, Crown, History, Download, Eye, KeyRound, Loader2, Sparkles } from 'lucide-react'

// 特徴タグ
function FeatureTag({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-slate-600 uppercase tracking-wide">{label}</span>
      <span className="text-[10px] text-slate-300 leading-snug">{value}</span>
    </div>
  )
}

export default function LeftPanel() {
  const {
    referenceImage, setReferenceImage,
    referenceAnalysis, isAnalyzingRef,
    round, phase, history, finalWinner,
    geminiApiKey, setGeminiApiKey,
  } = useTournamentStore()

  const fileInputRef = useRef(null)

  function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setReferenceImage(ev.target.result)
    reader.readAsDataURL(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file?.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = ev => setReferenceImage(ev.target.result)
    reader.readAsDataURL(file)
  }

  function downloadFinalWinner() {
    if (!finalWinner) return
    const a = document.createElement('a')
    a.href = finalWinner.imageUrl
    a.download = `face_winner_r${round}.png`
    a.click()
  }

  // 表示する特徴の優先順位
  const displayFeatures = referenceAnalysis?.features
    ? [
        ['目', referenceAnalysis.features.eyes],
        ['顔形', referenceAnalysis.features.face_shape],
        ['鼻', referenceAnalysis.features.nose],
        ['口・唇', referenceAnalysis.features.lips],
        ['眉', referenceAnalysis.features.eyebrows],
        ['髪', referenceAnalysis.features.hair],
        ['肌', referenceAnalysis.features.skin],
        ['雰囲気', referenceAnalysis.features.atmosphere],
      ]
    : []

  return (
    <div className="flex flex-col h-full overflow-y-auto gap-4 p-4 pr-3">

      {/* ── タイトル ── */}
      <div>
        <h1 className="text-base font-black tracking-tight text-slate-100 flex items-center gap-1.5">
          <Sparkles size={14} className="text-violet-400" />
          女性顔クリエーター
        </h1>
        <p className="text-[10px] text-slate-500 mt-0.5">プロンプト進化トーナメント</p>
      </div>

      {/* ── ラウンドバッジ ── */}
      {round > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-violet-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
            Round {round}
          </span>
          {history.length > 0 && (
            <span className="text-[10px] text-slate-500">{history.length}ラウンド済み</span>
          )}
          {phase === PHASE.COMPLETE && (
            <span className="bg-amber-500 text-slate-900 text-[10px] font-bold px-2.5 py-1 rounded-full">完了</span>
          )}
        </div>
      )}

      {/* ── 参照画像 ── */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 mb-1.5 flex items-center gap-1">
          <Eye size={11} /> 参照画像（目標とする顔）
        </p>

        {referenceImage ? (
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <img
              src={referenceImage}
              alt="Reference"
              className="w-full rounded-xl object-cover border-2 border-violet-500/60 shadow-lg shadow-violet-500/10"
              style={{ maxHeight: '220px', objectFit: 'cover', objectPosition: 'top' }}
            />
            <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <p className="text-white text-xs font-semibold flex items-center gap-1">
                <Upload size={13} /> クリックして変更
              </p>
            </div>
            <div className="absolute top-1.5 right-1.5 bg-violet-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              参照元
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-slate-700 hover:border-violet-500 rounded-xl p-5 text-center cursor-pointer transition-all duration-200 group"
          >
            <ImageIcon size={28} className="mx-auto mb-1.5 text-slate-600 group-hover:text-violet-400 transition-colors" />
            <p className="text-sm text-slate-400 group-hover:text-slate-200 font-semibold">顔画像をドロップ</p>
            <p className="text-[10px] text-slate-600 mt-0.5">またはクリックして選択</p>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      </div>

      {/* ── 参照画像の自動分析結果 ── */}
      {referenceImage && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 mb-1.5 flex items-center gap-1">
            <Sparkles size={10} className="text-violet-400" />
            検出された顔の特徴
          </p>

          {isAnalyzingRef ? (
            <div className="flex items-center gap-2 bg-slate-800 rounded-xl p-3">
              <Loader2 size={12} className="animate-spin text-violet-400 shrink-0" />
              <span className="text-[10px] text-slate-400">
                {geminiApiKey ? 'Gemini Vision で顔特徴を分析中…' : 'モック特徴を生成中…'}
              </span>
            </div>
          ) : referenceAnalysis ? (
            <div className="bg-slate-800/70 rounded-xl p-3 space-y-2 border border-slate-700/50">
              {displayFeatures.map(([label, value]) => value && (
                <FeatureTag key={label} label={label} value={value} />
              ))}
              {referenceAnalysis.features?.age_range && (
                <FeatureTag label="年齢層" value={referenceAnalysis.features.age_range} />
              )}
              {geminiApiKey && (
                <p className="text-[9px] text-violet-400 mt-1 pt-1 border-t border-slate-700">
                  ✅ この特徴をプロンプト生成に使用します
                </p>
              )}
              {!geminiApiKey && (
                <p className="text-[9px] text-slate-600 mt-1 pt-1 border-t border-slate-700">
                  ⚠️ APIキー未入力のためモック特徴です
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ── Gemini API Key ── */}
      <div>
        <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mb-1">
          <KeyRound size={11} /> Gemini API Key
        </label>
        <input
          type="password"
          value={geminiApiKey}
          onChange={e => setGeminiApiKey(e.target.value)}
          placeholder="AIza... (未入力でモック動作)"
          className="w-full text-[10px] bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        {geminiApiKey ? (
          <p className="text-[9px] text-emerald-400 mt-1">
            ✅ Imagen 3（参照画像付き）+ Gemini Vision 評価を使用
          </p>
        ) : (
          <p className="text-[9px] text-slate-600 mt-1">
            未入力：SVGモック画像で全機能をテスト可能
          </p>
        )}
      </div>

      {/* ── 勝者履歴 ── */}
      {history.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mb-1.5">
            <History size={11} /> ラウンド勝者履歴
          </p>
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {history.map(rec => (
              <div key={rec.round} className="flex items-center gap-2 bg-slate-800 rounded-lg p-1.5">
                <img src={rec.winner.imageUrl} alt="" className="w-8 h-8 object-cover rounded-md shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold text-amber-400 flex items-center gap-1">
                    <Crown size={8} /> Round {rec.round}
                    {rec.winner.evaluation && (
                      <span className="ml-1 text-slate-500 font-normal">{rec.winner.evaluation.score}%</span>
                    )}
                  </p>
                  <p className="text-[9px] text-slate-500 truncate">{rec.winner.prompt.slice(0, 38)}…</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 最終勝者 ── */}
      {finalWinner && (
        <div className="bg-amber-900/20 border border-amber-600/40 rounded-xl p-3">
          <p className="text-[10px] font-bold text-amber-400 flex items-center gap-1 mb-2">
            <Crown size={11} /> 最終勝者
            {finalWinner.evaluation && (
              <span className="ml-auto text-amber-300">{finalWinner.evaluation.score}% 類似</span>
            )}
          </p>
          <img
            src={finalWinner.imageUrl}
            alt="Final winner"
            className="w-full rounded-lg object-cover border border-amber-500/40 mb-2"
            style={{ maxHeight: '150px', objectFit: 'cover', objectPosition: 'top' }}
          />
          <p className="text-[9px] text-slate-400 font-mono line-clamp-2 mb-2">{finalWinner.prompt}</p>
          <button
            onClick={downloadFinalWinner}
            className="w-full flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-[11px] py-2 rounded-lg transition-all"
          >
            <Download size={12} /> 保存・ダウンロード
          </button>
        </div>
      )}

      {/* ── フッター ── */}
      <div className="mt-auto pt-2 border-t border-slate-800">
        <p className="text-[9px] text-slate-700">
          Claude Code → Gemini Vision → Imagen 3
        </p>
      </div>
    </div>
  )
}
