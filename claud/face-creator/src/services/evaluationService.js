/**
 * evaluationService.js
 * Gemini Vision による顔の類似度評価・特徴分析
 *
 * 2つの機能:
 * 1. analyzeReferenceImage  — 参照画像を詳細分析してプロンプトの素材を作る
 * 2. evaluateCandidate      — 参照画像 vs 生成画像の類似度を0-100でスコアリング
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

// DataURL から Gemini Parts に変換
function toImagePart(dataUrl) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/)
  if (!match) throw new Error('Invalid image data URL')
  return { inlineData: { mimeType: match[1], data: match[2] } }
}

// ── モックデータ ────────────────────────────────────────────

const MOCK_ANALYSIS = {
  features: {
    face_shape: 'oval face, soft jaw line, gentle cheekbones',
    eyes: 'almond-shaped eyes, double eyelids, dark brown irises',
    nose: 'small delicate nose, straight bridge, rounded tip',
    lips: 'full lips, defined cupid bow, natural pink tone',
    eyebrows: 'natural arched brows, medium thickness',
    skin: 'fair porcelain skin, smooth texture, natural glow',
    hair: 'straight dark brown hair, side-swept bangs',
    age_range: 'early to mid 20s',
    atmosphere: 'gentle, approachable, natural beauty',
  },
  prompt_base:
    'Photorealistic portrait of a young East Asian woman in her early 20s, oval face with soft jaw line, almond-shaped double-lid eyes, small straight-bridged nose, full lips with defined cupid bow, fair porcelain skin, straight dark hair with side bangs, gentle and approachable expression',
}

function mockEvaluation(index) {
  // カードごとに少しずつ異なるモックスコアを返す（UIテスト用）
  const base = 45 + (index * 7) % 30
  const featureScores = {
    face_shape: Math.min(100, base + Math.floor(Math.random() * 20)),
    eyes:       Math.min(100, base + Math.floor(Math.random() * 25)),
    nose:       Math.min(100, base + Math.floor(Math.random() * 20)),
    lips:       Math.min(100, base + Math.floor(Math.random() * 20)),
    eyebrows:   Math.min(100, base + Math.floor(Math.random() * 20)),
    skin:       Math.min(100, base + Math.floor(Math.random() * 15)),
    hair:       Math.min(100, base + Math.floor(Math.random() * 25)),
  }
  const avg = Math.round(
    Object.values(featureScores).reduce((a, b) => a + b, 0) /
    Object.keys(featureScores).length
  )
  return {
    score: avg,
    features: Object.fromEntries(
      Object.entries(featureScores).map(([k, v]) => [
        k,
        { score: v, note: v >= 70 ? '参照に近い' : '改善の余地あり' },
      ])
    ),
    strengths: Object.entries(featureScores)
      .filter(([, v]) => v >= 70)
      .map(([k]) => FEATURE_LABELS_EN[k]),
    improvements: Object.entries(featureScores)
      .filter(([, v]) => v < 65)
      .map(([k]) => FEATURE_LABELS_EN[k]),
  }
}

const FEATURE_LABELS_EN = {
  face_shape: 'face shape',
  eyes: 'eyes',
  nose: 'nose',
  lips: 'lips',
  eyebrows: 'eyebrows',
  skin: 'skin',
  hair: 'hair',
}

// ── 公開API ──────────────────────────────────────────────────

/**
 * 参照画像を分析してプロンプト生成に使う特徴テキストを返す
 * @param {string} imageDataUrl  参照画像 data URL
 * @param {string} apiKey
 * @returns {Promise<{ features: object, prompt_base: string }>}
 */
export async function analyzeReferenceImage(imageDataUrl, apiKey) {
  if (!apiKey) {
    await new Promise(r => setTimeout(r, 300))
    return MOCK_ANALYSIS
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `Analyze this female portrait photo and extract precise facial features for AI image generation.

Be specific and technical. Use terms that work well in Stable Diffusion / Imagen prompts.

Return ONLY valid JSON:
{
  "features": {
    "face_shape": "<e.g. oval face, defined jaw, high cheekbones>",
    "eyes": "<e.g. narrow almond eyes, single eyelids, dark brown irises, downturned>",
    "nose": "<e.g. small button nose, low bridge, wide nostrils>",
    "lips": "<e.g. thin lips, subtle cupid bow, pale pink>",
    "eyebrows": "<e.g. straight thick brows, close-set>",
    "skin": "<e.g. warm beige skin, visible pores, matte finish>",
    "hair": "<e.g. wavy black hair, blunt cut bob, no bangs>",
    "age_range": "<e.g. late teens>",
    "atmosphere": "<e.g. serious, confident, mysterious>"
  },
  "prompt_base": "<single 60-80 word prompt combining all features, starting with 'Photorealistic portrait of a'>"
}`

  try {
    const result = await model.generateContent([prompt, toImagePart(imageDataUrl)])
    const text = result.response.text()
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('No JSON in response')
    return JSON.parse(m[0])
  } catch (err) {
    console.error('analyzeReferenceImage failed:', err.message)
    return MOCK_ANALYSIS
  }
}

/**
 * 参照画像と候補画像の類似度を0-100でスコアリング
 * @param {string} refDataUrl        参照画像 data URL
 * @param {string} candidateDataUrl  候補画像 data URL
 * @param {string} apiKey
 * @param {number} candidateIndex    モック用インデックス
 */
export async function evaluateCandidate(refDataUrl, candidateDataUrl, apiKey, candidateIndex = 0) {
  if (!apiKey) {
    await new Promise(r => setTimeout(r, 150))
    return mockEvaluation(candidateIndex)
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `Compare these two female portraits:
Image 1: REFERENCE (target face)
Image 2: AI GENERATED (attempt to match)

Score the similarity for each feature (0=completely different, 100=identical match).

Return ONLY valid JSON:
{
  "score": <overall 0-100>,
  "features": {
    "face_shape": { "score": <0-100>, "note": "<10 words max>" },
    "eyes":       { "score": <0-100>, "note": "<10 words max>" },
    "nose":       { "score": <0-100>, "note": "<10 words max>" },
    "lips":       { "score": <0-100>, "note": "<10 words max>" },
    "eyebrows":   { "score": <0-100>, "note": "<10 words max>" },
    "skin":       { "score": <0-100>, "note": "<10 words max>" },
    "hair":       { "score": <0-100>, "note": "<10 words max>" }
  },
  "strengths":    ["<feature that matches>", ...],
  "improvements": ["<feature that differs>", ...]
}`

  try {
    const result = await model.generateContent([
      prompt,
      toImagePart(refDataUrl),
      toImagePart(candidateDataUrl),
    ])
    const text = result.response.text()
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('No JSON')
    return JSON.parse(m[0])
  } catch (err) {
    console.error('evaluateCandidate failed:', err.message)
    return mockEvaluation(candidateIndex)
  }
}

// 部位ラベル（日本語表示用）
export const FEATURE_LABELS_JA = {
  face_shape: '顔形',
  eyes:       '目',
  nose:       '鼻',
  lips:       '口・唇',
  eyebrows:   '眉',
  skin:       '肌',
  hair:       '髪',
}

export const FEATURE_ORDER = ['face_shape', 'eyes', 'nose', 'lips', 'eyebrows', 'skin', 'hair']
