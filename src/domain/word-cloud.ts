import type { TermCount } from "@/domain/text-analysis"

export type PlacedWord = {
  term: string
  count: number
  x: number
  y: number
  fontSize: number
}

export type WordCloudLayout = {
  width: number
  height: number
  words: PlacedWord[]
}

const COLORS = ["#1f6f6a", "#2f4f8f", "#8a5a12", "#7a3148", "#3f4a57"]

export function cloudFontSize(count: number, minCount: number, maxCount: number): number {
  if (maxCount <= minCount) {
    return 28
  }
  const ratio = (count - minCount) / (maxCount - minCount)
  return Math.round(16 + ratio * 40)
}

export function placeWordCloud(
  terms: readonly TermCount[],
  options?: { width?: number; maxWords?: number },
): WordCloudLayout {
  const width = options?.width ?? 960
  const maxWords = options?.maxWords ?? 70
  const selected = terms.slice(0, maxWords)
  if (selected.length === 0) {
    return { width, height: 160, words: [] }
  }
  const counts = selected.map((term) => term.count)
  const minCount = Math.min(...counts)
  const maxCount = Math.max(...counts)
  const words: PlacedWord[] = []
  let x = 28
  let y = 56
  let rowHeight = 0

  for (const term of selected) {
    const fontSize = cloudFontSize(term.count, minCount, maxCount)
    const estimated = Math.ceil(term.term.length * fontSize * 0.58) + 18
    if (x + estimated > width - 28) {
      x = 28
      y += rowHeight + 14
      rowHeight = 0
    }
    words.push({ term: term.term, count: term.count, x, y, fontSize })
    x += estimated
    rowHeight = Math.max(rowHeight, fontSize)
  }

  return { width, height: y + 36, words }
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export function buildWordCloudSvg(terms: readonly TermCount[]): string {
  const layout = placeWordCloud(terms)
  const texts = layout.words
    .map((word, index) => {
      const color = COLORS[index % COLORS.length]
      return `<text x="${word.x}" y="${word.y}" font-size="${word.fontSize}" font-family="Segoe UI, sans-serif" fill="${color}">${escapeXml(word.term)}</text>`
    })
    .join("")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}"><rect width="100%" height="100%" fill="#f7f4ee"/>${texts}</svg>`
}
