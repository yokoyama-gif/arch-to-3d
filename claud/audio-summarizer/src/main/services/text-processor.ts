import { SummaryResult, KeywordEntry, TranscriptionResult } from '../../shared/types'

// ============================================================
// 日本語ストップワード
// ============================================================
const JA_STOPWORDS = new Set([
  'の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ',
  'ある', 'いる', 'も', 'する', 'から', 'な', 'こと', 'として', 'い', 'や',
  'れる', 'など', 'なっ', 'ない', 'この', 'ため', 'その', 'あっ', 'よう',
  'また', 'もの', 'という', 'あり', 'まで', 'られ', 'なる', 'へ', 'か',
  'だ', 'これ', 'によって', 'により', 'おり', 'より', 'による', 'ず',
  'なり', 'られる', 'において', 'ば', 'なかっ', 'なく', 'しかし', 'について',
  'せ', 'だっ', 'その他', 'それ', 'そう', 'です', 'ます', 'えー', 'あの',
  'えーと', 'まあ', 'ちょっと', 'やっぱり', 'けど', 'でも', 'って', 'んで',
  'じゃ', 'ですね', 'ですが', 'ですけど', 'けれども', 'ところ', 'ところが'
])

const EN_STOPWORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
  'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go',
  'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him',
  'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some',
  'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look',
  'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after',
  'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even',
  'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
  'is', 'are', 'was', 'were', 'been', 'has', 'had', 'did', 'does',
  'um', 'uh', 'ah', 'oh', 'yeah', 'okay', 'ok', 'right', 'well'
])

// ============================================================
// テキスト分割
// ============================================================

function splitSentences(text: string, language: string): string[] {
  let sentences: string[]

  if (language === 'ja') {
    // 日本語: 。！？で分割
    sentences = text.split(/(?<=[。！？\n])/g)
  } else {
    // 英語: 文末ピリオド等で分割
    sentences = text.split(/(?<=[.!?\n])\s+/g)
  }

  return sentences
    .map(s => s.trim())
    .filter(s => s.length > 5)
}

function tokenize(text: string, language: string): string[] {
  if (language === 'ja') {
    return tokenizeJapanese(text)
  }
  return tokenizeEnglish(text)
}

function tokenizeJapanese(text: string): string[] {
  // 日本語のトークン化: 漢字列、カタカナ列、ひらがな列を抽出
  const tokens: string[] = []

  // 漢字の連続 (2文字以上)
  const kanjiMatches = text.match(/[\u4E00-\u9FFF]{2,}/g) || []
  tokens.push(...kanjiMatches)

  // カタカナの連続 (2文字以上)
  const katakanaMatches = text.match(/[\u30A0-\u30FF]{2,}/g) || []
  tokens.push(...katakanaMatches)

  // 漢字+ひらがなの複合語 (例: 経済的, 政治家)
  const compoundMatches = text.match(/[\u4E00-\u9FFF]+[\u3040-\u309F]{1,3}/g) || []
  tokens.push(...compoundMatches)

  return tokens.filter(t => !JA_STOPWORDS.has(t) && t.length >= 2)
}

function tokenizeEnglish(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !EN_STOPWORDS.has(w))
}

// ============================================================
// TF-IDF スコアリング
// ============================================================

function computeWordFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>()
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1)
  }
  return freq
}

function scoreSentence(
  sentence: string,
  wordScores: Map<string, number>,
  language: string
): number {
  const tokens = tokenize(sentence, language)
  if (tokens.length === 0) return 0

  let score = 0
  for (const token of tokens) {
    score += wordScores.get(token) || 0
  }

  // 文の長さで正規化（長すぎず短すぎない文を優先）
  const lengthPenalty = language === 'ja'
    ? Math.min(1, sentence.length / 50) * Math.min(1, 200 / sentence.length)
    : Math.min(1, tokens.length / 8) * Math.min(1, 40 / tokens.length)

  return (score / tokens.length) * lengthPenalty
}

// ============================================================
// 公開API
// ============================================================

export function generateSummary(
  transcription: TranscriptionResult
): SummaryResult {
  const { fullText, language } = transcription
  const sentences = splitSentences(fullText, language)

  if (sentences.length === 0) {
    return { short: fullText, standard: fullText, detailed: fullText }
  }

  const allTokens = tokenize(fullText, language)
  const wordFreq = computeWordFrequency(allTokens)

  // スコア正規化
  const maxFreq = Math.max(...wordFreq.values(), 1)
  const wordScores = new Map<string, number>()
  for (const [word, freq] of wordFreq) {
    wordScores.set(word, freq / maxFreq)
  }

  // 文のスコアリング
  const scoredSentences = sentences.map((sentence, index) => ({
    sentence,
    index,
    score: scoreSentence(sentence, wordScores, language)
  }))

  scoredSentences.sort((a, b) => b.score - a.score)

  // 短い要約: 上位3文（元の順序で）
  const shortCount = Math.min(3, sentences.length)
  const shortSentences = scoredSentences
    .slice(0, shortCount)
    .sort((a, b) => a.index - b.index)
    .map(s => s.sentence)

  // 標準要約: 上位7文
  const standardCount = Math.min(7, sentences.length)
  const standardSentences = scoredSentences
    .slice(0, standardCount)
    .sort((a, b) => a.index - b.index)
    .map(s => s.sentence)

  // 詳細要約: 上位15文
  const detailedCount = Math.min(15, sentences.length)
  const detailedSentences = scoredSentences
    .slice(0, detailedCount)
    .sort((a, b) => a.index - b.index)
    .map(s => s.sentence)

  return {
    short: shortSentences.join('\n'),
    standard: standardSentences.join('\n'),
    detailed: detailedSentences.join('\n')
  }
}

export function generateBulletPoints(
  transcription: TranscriptionResult
): string[] {
  const { fullText, language } = transcription
  const sentences = splitSentences(fullText, language)

  if (sentences.length === 0) return [fullText]

  const allTokens = tokenize(fullText, language)
  const wordFreq = computeWordFrequency(allTokens)
  const maxFreq = Math.max(...wordFreq.values(), 1)
  const wordScores = new Map<string, number>()
  for (const [word, freq] of wordFreq) {
    wordScores.set(word, freq / maxFreq)
  }

  const scoredSentences = sentences.map((sentence, index) => ({
    sentence,
    index,
    score: scoreSentence(sentence, wordScores, language)
  }))

  scoredSentences.sort((a, b) => b.score - a.score)

  const count = Math.min(10, sentences.length)
  return scoredSentences
    .slice(0, count)
    .sort((a, b) => a.index - b.index)
    .map(s => s.sentence.replace(/\n/g, ' ').trim())
}

export function extractKeywords(
  transcription: TranscriptionResult
): KeywordEntry[] {
  const { fullText, language } = transcription
  const allTokens = tokenize(fullText, language)
  const wordFreq = computeWordFrequency(allTokens)

  // TF-IDFライクなスコアリング
  // 高頻度すぎる語はペナルティ
  const totalTokens = allTokens.length || 1
  const entries: KeywordEntry[] = []

  for (const [word, freq] of wordFreq) {
    if (freq < 2) continue // 1回しか出ない語は除外

    const tf = freq / totalTokens
    // 頻度が高すぎるものにペナルティ（上位10%以上）
    const ratio = freq / totalTokens
    const penalty = ratio > 0.05 ? 0.5 : 1.0
    const score = tf * penalty * word.length // 長い語に若干ボーナス

    entries.push({ word, score: Math.round(score * 10000) / 10000 })
  }

  entries.sort((a, b) => b.score - a.score)
  return entries.slice(0, 20)
}

export function processText(transcription: TranscriptionResult) {
  return {
    summary: generateSummary(transcription),
    bulletPoints: generateBulletPoints(transcription),
    keywords: extractKeywords(transcription)
  }
}
