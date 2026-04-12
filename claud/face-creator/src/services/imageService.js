/**
 * imageService.js
 * 画像生成サービス
 *
 * Priority:
 * 1. Imagen 3 (reference_image 対応) — 最も精度高い
 * 2. Gemini 2.0 Flash image generation — フォールバック
 * 3. SVG モック — APIキー未入力時
 *
 * Imagen 3 の reference_images 機能を使うと、
 * テキストプロンプトだけでなく参照顔画像を直接渡せるので
 * 顔の一致度が大幅に向上する。
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

// ── Mock SVG 生成 ─────────────────────────────────────────
function hashCode(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function generateMockImage(prompt, index = 0) {
  const h = hashCode(prompt + index)
  const skinH = (h % 25) + 10
  const hairH = (h * 7) % 360
  const eyeH  = (h * 13) % 360
  const lipH  = 350 + (h % 20) - 10
  const bgH   = (h * 3) % 360

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="480" viewBox="0 0 400 480">
  <defs>
    <radialGradient id="bg${index}" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="hsl(${bgH},25%,18%)"/>
      <stop offset="100%" stop-color="hsl(${bgH},15%,8%)"/>
    </radialGradient>
    <radialGradient id="skin${index}" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="hsl(${skinH},40%,82%)"/>
      <stop offset="100%" stop-color="hsl(${skinH},35%,70%)"/>
    </radialGradient>
  </defs>
  <rect width="400" height="480" fill="url(#bg${index})"/>
  <rect x="175" y="345" width="50" height="80" rx="8" fill="hsl(${skinH},38%,73%)"/>
  <ellipse cx="200" cy="460" rx="120" ry="35" fill="hsl(${hairH},20%,22%)"/>
  <ellipse cx="200" cy="235" rx="105" ry="128" fill="url(#skin${index})"/>
  <ellipse cx="200" cy="138" rx="118" ry="88" fill="hsl(${hairH},38%,22%)"/>
  <ellipse cx="108" cy="220" rx="28" ry="75" fill="hsl(${hairH},38%,22%)"/>
  <ellipse cx="292" cy="220" rx="28" ry="75" fill="hsl(${hairH},38%,22%)"/>
  <ellipse cx="98" cy="240" rx="14" ry="18" fill="hsl(${skinH},35%,72%)"/>
  <ellipse cx="302" cy="240" rx="14" ry="18" fill="hsl(${skinH},35%,72%)"/>
  <path d="M155 190 Q175 183 195 190" stroke="hsl(${hairH},30%,28%)" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <path d="M205 190 Q225 183 245 190" stroke="hsl(${hairH},30%,28%)" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="172" cy="210" rx="22" ry="13" fill="white"/>
  <ellipse cx="228" cy="210" rx="22" ry="13" fill="white"/>
  <circle cx="172" cy="210" r="10" fill="hsl(${eyeH},50%,32%)"/>
  <circle cx="228" cy="210" r="10" fill="hsl(${eyeH},50%,32%)"/>
  <circle cx="172" cy="210" r="5" fill="#111"/>
  <circle cx="228" cy="210" r="5" fill="#111"/>
  <circle cx="175" cy="207" r="2.5" fill="rgba(255,255,255,0.9)"/>
  <circle cx="231" cy="207" r="2.5" fill="rgba(255,255,255,0.9)"/>
  <path d="M150 205 Q172 196 194 205" stroke="#222" stroke-width="2" fill="none"/>
  <path d="M206 205 Q228 196 250 205" stroke="#222" stroke-width="2" fill="none"/>
  <path d="M200 222 L195 250 Q200 258 205 250 L200 222" stroke="hsl(${skinH},25%,62%)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="193" cy="255" rx="7" ry="5" fill="hsl(${skinH},25%,60%)" opacity="0.6"/>
  <ellipse cx="207" cy="255" rx="7" ry="5" fill="hsl(${skinH},25%,60%)" opacity="0.6"/>
  <path d="M178 275 Q190 270 200 272 Q210 270 222 275 Q212 285 200 287 Q188 285 178 275Z" fill="hsl(${lipH},52%,58%)"/>
  <path d="M178 275 Q200 281 222 275" stroke="hsl(${lipH},45%,48%)" stroke-width="1" fill="none"/>
  <ellipse cx="196" cy="277" rx="7" ry="3" fill="rgba(255,255,255,0.25)"/>
  <circle cx="148" cy="248" r="22" fill="hsl(350,60%,72%)" opacity="0.22"/>
  <circle cx="252" cy="248" r="22" fill="hsl(350,60%,72%)" opacity="0.22"/>
  <rect x="0" y="440" width="400" height="40" fill="rgba(0,0,0,0.55)"/>
  <text x="200" y="458" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="10" font-family="monospace">MOCK #${index + 1} — No API Key</text>
  <text x="200" y="473" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="9" font-family="monospace">${prompt.slice(0, 46)}…</text>
</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// ── Imagen 3（reference_image 対応版）─────────────────────
async function generateWithImagen(prompt, apiKey, referenceImageDataUrl) {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'imagen-3.0-generate-001' })

  const params = {
    prompt,
    numberOfImages: 1,
    aspectRatio: '3:4',
    safetyFilterLevel: 'BLOCK_ONLY_HIGH',
  }

  // ── reference_image 対応（顔一致率を大幅向上）──
  // Imagen 3 が subject reference をサポートする場合に有効化
  if (referenceImageDataUrl) {
    const m = referenceImageDataUrl.match(/^data:(.+);base64,(.+)$/)
    if (m) {
      params.referenceImages = [
        {
          referenceType: 'REFERENCE_TYPE_SUBJECT',
          referenceImage: { bytesBase64Encoded: m[2] },
          subjectImageConfig: { subjectType: 'SUBJECT_TYPE_PERSON' },
        },
      ]
    }
  }

  const result = await model.generateImages(params)
  const imageData = result.images[0].imageData
  return `data:image/png;base64,${imageData}`
}

// ── Gemini 2.0 Flash Image Generation（フォールバック）──
async function generateWithGeminiFlash(prompt, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-preview-image-generation',
  })
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'] },
  })
  const part = result.response.candidates[0].content.parts.find(p => p.inlineData)
  if (!part) throw new Error('No image part in response')
  return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
}

/**
 * 画像生成のメインエントリポイント
 * @param {string} prompt                  英語プロンプト
 * @param {string} apiKey                  Gemini API キー（空ならモック）
 * @param {number} index                   カード番号（モック用）
 * @param {string|null} referenceImageDataUrl  参照画像（Imagen 3 subject reference用）
 */
export async function generateImage(prompt, apiKey, index = 0, referenceImageDataUrl = null) {
  if (!apiKey) {
    await new Promise(r => setTimeout(r, 400 + Math.random() * 600))
    return generateMockImage(prompt, index)
  }

  try {
    return await generateWithImagen(prompt, apiKey, referenceImageDataUrl)
  } catch (e1) {
    console.warn('Imagen 3 failed, trying gemini-flash:', e1.message)
    // reference_image なしで再試行（Imagen 3がサポートしない場合）
    if (referenceImageDataUrl) {
      try {
        return await generateWithImagen(prompt, apiKey, null)
      } catch (e2) {
        console.warn('Imagen 3 (no ref) failed:', e2.message)
      }
    }
    try {
      return await generateWithGeminiFlash(prompt, apiKey)
    } catch (e3) {
      console.error('All generation methods failed, using mock:', e3.message)
      return generateMockImage(prompt, index)
    }
  }
}
