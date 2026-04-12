/**
 * tournamentStore.js — Zustand グローバルストア v2
 *
 * v2 の追加:
 * - referenceAnalysis: 参照画像の自動特徴分析結果
 * - evaluation: 各候補の類似度スコア（部位別）
 * - partFeedback: 部位別 good/bad フィードバック
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateImage } from '../services/imageService'
import { generateInitialPrompts, evolvePrompts, generateRoundInsight } from '../services/promptService'
import { analyzeReferenceImage, evaluateCandidate } from '../services/evaluationService'

export const PHASE = {
  SETUP: 'setup',
  READY: 'ready',
  GENERATING: 'generating',
  VOTING: 'voting',
  COMPLETE: 'complete',
}

const initialState = {
  referenceImage: null,
  referenceAnalysis: null,   // analyzeReferenceImage の結果
  isAnalyzingRef: false,     // 参照画像分析中フラグ
  round: 0,
  candidateCount: 4,
  candidates: [],
  history: [],
  finalWinner: null,
  roundInsight: '',
  isGenerating: false,
  isEvaluating: false,       // 類似度評価中フラグ
  generationProgress: 0,
  error: null,
  phase: PHASE.SETUP,
  geminiApiKey: '',
}

/*
  Candidate: {
    id, imageUrl, prompt,
    rankFlag: 'normal' | 'winner' | 'loser',
    feedback: string,
    partFeedback: { face_shape, eyes, nose, lips, eyebrows, skin, hair } → 'good'|'bad'|null,
    evaluation: { score, features: { [key]: { score, note } }, strengths, improvements } | null,
    isCarriedOver: boolean,
    roundGenerated: number,
  }
*/

export const useTournamentStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      // ── 参照画像セット + 自動分析 ────────────────────────
      setReferenceImage: async (dataUrl) => {
        set({ referenceImage: dataUrl, phase: PHASE.READY, error: null, isAnalyzingRef: true, referenceAnalysis: null })

        const { geminiApiKey } = get()
        try {
          const analysis = await analyzeReferenceImage(dataUrl, geminiApiKey)
          set({ referenceAnalysis: analysis, isAnalyzingRef: false })
        } catch (err) {
          console.error('Reference analysis failed:', err)
          set({ isAnalyzingRef: false })
        }
      },

      setCandidateCount: (count) => set({ candidateCount: count }),

      setGeminiApiKey: (key) => {
        set({ geminiApiKey: key })
        localStorage.setItem('face_creator_api_key', key)
      },

      setFeedback: (id, text) => set(s => ({
        candidates: s.candidates.map(c => c.id === id ? { ...c, feedback: text } : c),
      })),

      setPartFeedback: (id, partKey, value) => set(s => ({
        candidates: s.candidates.map(c =>
          c.id === id
            ? { ...c, partFeedback: { ...c.partFeedback, [partKey]: c.partFeedback?.[partKey] === value ? null : value } }
            : c
        ),
      })),

      // ── 勝者・敗者選択 ──────────────────────────────────
      selectWinner: (id) => set(s => ({
        candidates: s.candidates.map(c => ({
          ...c,
          rankFlag: c.id === id ? 'winner' : c.rankFlag === 'winner' ? 'normal' : c.rankFlag,
        })),
      })),

      selectLoser: (id) => set(s => ({
        candidates: s.candidates.map(c => ({
          ...c,
          rankFlag: c.id === id ? 'loser' : c.rankFlag === 'loser' ? 'normal' : c.rankFlag,
        })),
      })),

      // ── 全候補の類似度評価（バックグラウンド）──────────
      evaluateAllCandidates: async () => {
        const { candidates, referenceImage, geminiApiKey } = get()
        if (!referenceImage) return

        set({ isEvaluating: true })

        // 並列評価
        const results = await Promise.allSettled(
          candidates.map((c, i) =>
            evaluateCandidate(referenceImage, c.imageUrl, geminiApiKey, i)
          )
        )

        const updatedCandidates = candidates.map((c, i) => ({
          ...c,
          evaluation: results[i].status === 'fulfilled' ? results[i].value : null,
        }))

        set({ candidates: updatedCandidates, isEvaluating: false })
      },

      // ── ラウンド1生成 ────────────────────────────────────
      startGeneration: async () => {
        const { candidateCount, referenceImage, geminiApiKey, referenceAnalysis } = get()
        set({ isGenerating: true, phase: PHASE.GENERATING, error: null, generationProgress: 0 })

        try {
          set({ generationProgress: 10 })
          const prompts = await generateInitialPrompts(candidateCount, referenceImage, geminiApiKey, referenceAnalysis)

          let done = 0
          const candidates = await Promise.all(
            prompts.map(async (prompt, i) => {
              // 参照画像を Imagen 3 に渡して生成精度を向上
              const imageUrl = await generateImage(prompt, geminiApiKey, i, referenceImage)
              done++
              set({ generationProgress: 10 + Math.round((done / prompts.length) * 80) })
              return {
                id: `r1-c${i + 1}`,
                imageUrl,
                prompt,
                rankFlag: 'normal',
                feedback: '',
                partFeedback: {},
                evaluation: null,
                isCarriedOver: false,
                roundGenerated: 1,
              }
            })
          )

          set({ candidates, round: 1, isGenerating: false, generationProgress: 100, phase: PHASE.VOTING })

          // バックグラウンドで類似度評価を開始
          get().evaluateAllCandidates()
        } catch (err) {
          set({ isGenerating: false, phase: PHASE.READY, error: err.message })
        }
      },

      // ── 次ラウンドへ ────────────────────────────────────
      nextRound: async () => {
        const { candidates, history, round, candidateCount, referenceImage, geminiApiKey, referenceAnalysis } = get()

        const winner = candidates.find(c => c.rankFlag === 'winner')
        const loser  = candidates.find(c => c.rankFlag === 'loser')

        if (!winner) {
          set({ error: '1位（勝者）を選択してください' })
          return
        }

        const record = {
          round,
          candidates: candidates.map(c => ({ ...c })),
          winner: { ...winner },
          loser: loser ? { ...loser } : null,
          timestamp: new Date().toISOString(),
        }

        set({ history: [...history, record], isGenerating: true, phase: PHASE.GENERATING, error: null, generationProgress: 0 })

        try {
          set({ generationProgress: 5 })
          const newCount = candidateCount - 1

          const [insight, newPrompts] = await Promise.all([
            generateRoundInsight(winner, loser, geminiApiKey, winner.evaluation),
            evolvePrompts(winner, loser, newCount, referenceImage, geminiApiKey, referenceAnalysis, winner.evaluation, loser?.evaluation),
          ])

          set({ roundInsight: insight, generationProgress: 20 })

          const nextRound = round + 1
          let done = 0

          const newCandidates = [
            {
              ...winner,
              id: `r${nextRound}-c1`,
              rankFlag: 'normal',
              feedback: '',
              partFeedback: {},
              isCarriedOver: true,
            },
            ...(await Promise.all(
              newPrompts.map(async (prompt, i) => {
                const imageUrl = await generateImage(prompt, geminiApiKey, i + 1, referenceImage)
                done++
                set({ generationProgress: 20 + Math.round((done / newCount) * 75) })
                return {
                  id: `r${nextRound}-c${i + 2}`,
                  imageUrl,
                  prompt,
                  rankFlag: 'normal',
                  feedback: '',
                  partFeedback: {},
                  evaluation: null,
                  isCarriedOver: false,
                  roundGenerated: nextRound,
                }
              })
            )),
          ]

          set({ candidates: newCandidates, round: nextRound, isGenerating: false, generationProgress: 100, phase: PHASE.VOTING })

          // バックグラウンド評価
          get().evaluateAllCandidates()
        } catch (err) {
          set({ isGenerating: false, phase: PHASE.VOTING, error: err.message })
        }
      },

      // ── 最終勝者保存 ────────────────────────────────────
      saveFinalWinner: () => {
        const { candidates, history, round } = get()
        const winner = candidates.find(c => c.rankFlag === 'winner')
        if (!winner) { set({ error: '1位（勝者）を選択してください' }); return }
        const loser = candidates.find(c => c.rankFlag === 'loser')
        set({
          history: [...history, { round, candidates: candidates.map(c => ({ ...c })), winner: { ...winner }, loser: loser ? { ...loser } : null, timestamp: new Date().toISOString() }],
          finalWinner: { ...winner },
          phase: PHASE.COMPLETE,
        })
      },

      clearError: () => set({ error: null }),

      reset: () => {
        const { geminiApiKey } = get()
        set({ ...initialState, geminiApiKey, phase: PHASE.SETUP })
      },
    }),
    {
      name: 'face-tournament-v2',
      partialize: s => ({
        geminiApiKey: s.geminiApiKey,
        history: s.history,
        finalWinner: s.finalWinner,
      }),
    }
  )
)
