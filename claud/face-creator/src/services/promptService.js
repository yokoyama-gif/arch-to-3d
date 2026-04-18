/**
 * promptService.js
 * プロンプト生成・進化ロジック
 *
 * APIキーあり → Gemini（参照画像を視覚分析してプロンプト生成）
 * APIキーなし → テンプレートベースのモック
 *
 * v2: referenceAnalysis と evaluationResults を活用した精度向上
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

// ── DataURL パーサ ────────────────────────────────────────
function toImagePart(dataUrl) {
  const m = dataUrl.match(/^data:(.+);base64,(.+)$/)
  if (!m) return null
  return { inlineData: { mimeType: m[1], data: m[2] } }
}

// ── 方向性バリエーション ──────────────────────────────────
const FOCUS_AREAS = [
  { hint: 'Focus on face shape, jaw line, cheekbones, and overall bone structure' },
  { hint: 'Focus on eye shape, eyelid type, iris color, gaze direction, and lash detail' },
  { hint: 'Focus on nose bridge height, nose tip shape, nostril width, and nose proportions' },
  { hint: 'Focus on lip fullness, cupid bow definition, lip color, and mouth width' },
  { hint: 'Focus on hair texture, hair color, hairstyle silhouette, and bangs detail' },
  { hint: 'Focus on skin tone, skin texture, facial radiance, and pore visibility' },
  { hint: 'Focus on eyebrow thickness, arch shape, and spacing between brows and eyes' },
  { hint: 'Focus on overall atmosphere, personality impression, and emotional expression' },
]

// ── モックプロンプト生成 ──────────────────────────────────
function buildMockPrompts(count, referenceAnalysis) {
  const base = referenceAnalysis?.prompt_base ||
    'Photorealistic portrait of a young East Asian woman'

  return FOCUS_AREAS.slice(0, count).map(f =>
    `${base}, ${f.hint}, studio lighting, clean neutral background, shallow depth of field, sharp focus, professional photography, 8K resolution`
  )
}

function buildEvolvedMockPrompts(winner, loser, count, referenceAnalysis, winnerEval, loserEval) {
  const base = winner.prompt.slice(0, 180)

  // 評価データから改善すべき部位を抽出
  const weakFeatures = loserEval
    ? Object.entries(loserEval.features || {})
        .filter(([, v]) => v.score < 65)
        .map(([k]) => k)
    : []

  const improvements = weakFeatures.length > 0
    ? `Improve these weak features: ${weakFeatures.join(', ')}`
    : loser?.feedback || 'general improvement'

  const partFeedback = loser?.partFeedback || {}
  const badParts = Object.entries(partFeedback).filter(([, v]) => v === 'bad').map(([k]) => k)
  const goodParts = Object.entries(partFeedback).filter(([, v]) => v === 'good').map(([k]) => k)

  return FOCUS_AREAS.slice(0, count).map((f, i) => {
    let prompt = `${base}, ${f.hint}`
    if (goodParts.length) prompt += `, keep: ${goodParts.join(', ')}`
    if (badParts.length) prompt += `, fix: ${badParts.join(', ')}`
    if (improvements && i === 0) prompt += `, ${improvements}`
    return prompt + ', highly detailed, photorealistic'
  })
}

// ── Gemini テキスト生成 ──────────────────────────────────
async function callGemini(parts, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
  const result = await model.generateContent(parts)
  const text = result.response.text()
  const m = text.match(/\[[\s\S]*\]/)
  if (!m) throw new Error('No JSON array in response')
  return JSON.parse(m[0])
}

// ── 公開API ──────────────────────────────────────────────

/**
 * 初期ラウンドのプロンプトを生成
 * referenceAnalysis があればそのprompt_baseを使い精度を上げる
 */
export async function generateInitialPrompts(count, refImage, apiKey, referenceAnalysis) {
  if (!apiKey) {
    await new Promise(r => setTimeout(r, 200))
    return buildMockPrompts(count, referenceAnalysis)
  }

  const focusLines = FOCUS_AREAS.slice(0, count).map((f, i) => `${i + 1}. ${f.hint}`)
  const baseDesc = referenceAnalysis?.prompt_base || ''
  const featureDetails = referenceAnalysis?.features
    ? Object.entries(referenceAnalysis.features)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n')
    : ''

  const textPrompt = `You are an expert AI image prompt engineer for photorealistic female portraits.

${refImage ? 'A reference portrait has been analyzed. Use these detected features as the foundation:' : ''}
${featureDetails}
${baseDesc ? `Base description: "${baseDesc}"` : ''}

Generate EXACTLY ${count} unique portrait prompts. Each must focus on a different aspect:
${focusLines.join('\n')}

Rules:
- Each prompt: 70-120 words, photorealistic, professional photography
- Include the detected facial features above in every prompt
- Vary only the emphasis/focus area, not the core features
- Include: studio lighting, clean background, sharp focus, 8K
- No explicit/inappropriate content

Return ONLY a JSON array of ${count} strings:
["prompt1", "prompt2", ...]`

  const parts = [textPrompt]
  if (refImage) {
    const imgPart = toImagePart(refImage)
    if (imgPart) parts.push(imgPart)
  }

  try {
    return await callGemini(parts, apiKey)
  } catch (err) {
    console.error('generateInitialPrompts failed:', err.message)
    return buildMockPrompts(count, referenceAnalysis)
  }
}

/**
 * 次ラウンドのプロンプトを進化させる
 * 評価スコア（winnerEval/loserEval）と部位別フィードバックを活用
 */
export async function evolvePrompts(winner, loser, count, refImage, apiKey, referenceAnalysis, winnerEval, loserEval) {
  if (!apiKey) {
    await new Promise(r => setTimeout(r, 200))
    return buildEvolvedMockPrompts(winner, loser, count, referenceAnalysis, winnerEval, loserEval)
  }

  // 評価スコアから具体的な改善指示を組み立て
  const scoreReport = winnerEval
    ? `Winner similarity score: ${winnerEval.score}/100\n` +
      Object.entries(winnerEval.features || {})
        .map(([k, v]) => `  - ${k}: ${v.score}/100 (${v.note})`)
        .join('\n')
    : ''

  const weakPoints = loserEval
    ? Object.entries(loserEval.features || {})
        .filter(([, v]) => v.score < 65)
        .map(([k, v]) => `${k} (scored ${v.score}: ${v.note})`)
        .join(', ')
    : ''

  // 部位別フィードバック
  const partFeedback = loser?.partFeedback || {}
  const goodParts = Object.entries(partFeedback).filter(([, v]) => v === 'good').map(([k]) => k)
  const badParts  = Object.entries(partFeedback).filter(([, v]) => v === 'bad').map(([k]) => k)

  const featureDetails = referenceAnalysis?.features
    ? Object.entries(referenceAnalysis.features).map(([k, v]) => `- ${k}: ${v}`).join('\n')
    : ''

  const textPrompt = `You are an expert AI image prompt engineer. Generate IMPROVED portrait prompts based on feedback.

REFERENCE IMAGE FEATURES:
${featureDetails}

CURRENT BEST PROMPT (WINNER — preserve its strengths):
"""
${winner.prompt}
"""
${scoreReport}
${winner.feedback ? `User note: "${winner.feedback}"` : ''}
${goodParts.length ? `User confirmed GOOD: ${goodParts.join(', ')}` : ''}

${loser ? `WORST PROMPT (LOSER — fix its weaknesses):
"""
${loser.prompt}
"""
${weakPoints ? `Low-scoring features: ${weakPoints}` : ''}
${loser.feedback ? `User note: "${loser.feedback}"` : ''}
${badParts.length ? `User confirmed BAD: ${badParts.join(', ')}` : ''}` : ''}

Generate EXACTLY ${count} IMPROVED prompts that:
1. Preserve all features that scored high in the winner
2. ${weakPoints ? `Specifically fix: ${weakPoints}` : 'Improve overall similarity'}
3. ${badParts.length ? `Prioritize correcting: ${badParts.join(', ')}` : 'Explore varied improvements'}
4. Each focuses on a different improvement angle
5. Keep 70-110 words each, photorealistic style

Return ONLY a JSON array of ${count} strings:
["evolved1", "evolved2", ...]`

  const parts = [textPrompt]
  if (refImage) {
    const imgPart = toImagePart(refImage)
    if (imgPart) parts.push(imgPart)
  }

  try {
    return await callGemini(parts, apiKey)
  } catch (err) {
    console.error('evolvePrompts failed:', err.message)
    return buildEvolvedMockPrompts(winner, loser, count, referenceAnalysis, winnerEval, loserEval)
  }
}

/**
 * ラウンドサマリーコメントを生成
 */
export async function generateRoundInsight(winner, loser, apiKey, winnerEval) {
  if (!apiKey) {
    const score = winnerEval?.score
    const scoreText = score ? `（類似度 ${score}点）` : ''
    return `✅ 今ラウンドの勝者${scoreText}の強みを引き継ぎます。\n❌ 弱点「${loser?.feedback || loser?.improvements?.[0] || '精度'}」を次ラウンドで改善します。\n➡️ ${winnerEval?.improvements?.length ? `特に「${winnerEval.improvements.join('・')}」を重点的に調整します。` : '全体的な類似度向上を目指します。'}`
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `Summarize a portrait generation tournament round in Japanese (2-3 short sentences):

Winner score: ${winnerEval?.score ?? '?'}/100
Winner strengths: ${winnerEval?.strengths?.join(', ') || winner.feedback || 'none'}
Areas to improve: ${winnerEval?.improvements?.join(', ') || loser?.feedback || 'general'}

Write: 1) what was good, 2) what to fix, 3) how next round will improve. Reply in Japanese only. Be concise.`

  try {
    const result = await model.generateContent(prompt)
    return result.response.text()
  } catch {
    return `勝者の特徴を維持しながら、弱点「${loser?.feedback || '精度'}」を改善した候補を生成します。`
  }
}
