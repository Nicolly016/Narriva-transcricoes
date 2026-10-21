import { formatClock, type CaptionCue } from "@/domain/captions"
import { collapseRepeatedSpeech } from "@/domain/local-transcript"

export type ExportSegment = {
  speakerName: string
  startMs: number
  endMs: number
  text: string
}

export type ExportDocument = {
  title: string
  language: string
  segments: readonly ExportSegment[]
}

export type TranscriptPiece = {
  id: string
  speakerName: string
  colorToken: string
  text: string
}

export type TranscriptTurn = {
  id: string
  speakerName: string
  colorToken: string
  text: string
  extraIds: string[]
}

function paragraphs(text: string): string {
  if (text.includes("\n")) {
    return text
  }
  const sentences = text.split(/(?<=[.!?…])\s+/).filter((sentence) => sentence.length > 0)
  if (sentences.length <= 2) {
    return text
  }
  const groups: string[] = []
  let current: string[] = []
  for (const sentence of sentences) {
    current.push(sentence)
    const joined = current.join(" ")
    if (current.length >= 3 || joined.length >= 280 || /[?]$/.test(sentence)) {
      groups.push(joined)
      current = []
    }
  }
  if (current.length > 0) {
    groups.push(current.join(" "))
  }
  return groups.join("\n\n")
}

export function groupTranscriptTurns(pieces: readonly TranscriptPiece[]): TranscriptTurn[] {
  const turns: TranscriptTurn[] = []
  for (const piece of pieces) {
    const text = piece.text.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim()
    if (!text) {
      continue
    }
    const speakerName = piece.speakerName.trim() || "Participante"
    const last = turns[turns.length - 1]
    if (last && last.speakerName === speakerName) {
      last.text = `${last.text} ${text}`
      last.extraIds.push(piece.id)
      continue
    }
    turns.push({
      id: piece.id,
      speakerName,
      colorToken: piece.colorToken,
      text,
      extraIds: [],
    })
  }
  return turns.map((turn) => ({ ...turn, text: paragraphs(collapseRepeatedSpeech(turn.text)) }))
}

function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

export function buildPlainTranscript(document: ExportDocument): string {
  const lines = [`${document.title}`, ""]
  for (const segment of document.segments) {
    lines.push(`[${formatClock(segment.startMs)}] ${segment.speakerName}`)
    lines.push(segment.text.trim())
    lines.push("")
  }
  return lines.join("\n")
}

export function buildTranscriptCsv(document: ExportDocument): string {
  const rows = ["inicio_ms,fim_ms,participante,texto"]
  for (const segment of document.segments) {
    rows.push(
      [
        String(segment.startMs),
        String(segment.endMs),
        csvField(segment.speakerName),
        csvField(segment.text),
      ].join(","),
    )
  }
  return rows.join("\n") + "\n"
}

export function buildTranscriptJson(document: ExportDocument): string {
  return JSON.stringify(
    {
      titulo: document.title,
      idioma: document.language,
      segmentos: document.segments.map((segment) => ({
        inicio_ms: segment.startMs,
        fim_ms: segment.endMs,
        participante: segment.speakerName,
        texto: segment.text,
      })),
    },
    null,
    2,
  )
}

export function captionCues(document: ExportDocument): CaptionCue[] {
  return document.segments.map((segment) => ({
    startMs: segment.startMs,
    endMs: segment.endMs,
    text: `${segment.speakerName}: ${segment.text.trim()}`,
  }))
}
