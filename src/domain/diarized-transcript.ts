import { speakerDisplayName, speakerSwatch } from "@/domain/speakers"

export type ParsedDiarizedSegment = {
  id: string
  speakerLabel: string
  startSeconds: number
  endSeconds: number
  text: string
}

export type ParsedDiarizedTranscript = {
  text: string
  durationSeconds: number | null
  segments: ParsedDiarizedSegment[]
}

export type SpeakerDraft = {
  providerLabel: string
  displayName: string
  colorToken: string
  sortOrder: number
  chunkIndex: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

export function parseDiarizedTranscript(payload: unknown): ParsedDiarizedTranscript {
  if (!isRecord(payload)) {
    throw new Error("A resposta da transcrição não é um objeto JSON.")
  }

  const rawSegments = Array.isArray(payload.segments) ? payload.segments : []
  const segments: ParsedDiarizedSegment[] = []
  rawSegments.forEach((item, index) => {
    if (!isRecord(item)) {
      return
    }
    const text = typeof item.text === "string" ? item.text.trim() : ""
    if (!text) {
      return
    }
    const start = Math.max(0, finiteNumber(item.start, 0))
    const end = Math.max(start, finiteNumber(item.end, start))
    const speaker =
      typeof item.speaker === "string" && item.speaker.trim().length > 0
        ? item.speaker.trim()
        : "A"
    const id = typeof item.id === "string" && item.id.trim().length > 0 ? item.id.trim() : `seg-${index}`
    segments.push({ id, speakerLabel: speaker, startSeconds: start, endSeconds: end, text })
  })

  const textFromField = typeof payload.text === "string" ? payload.text.trim() : ""
  const text = textFromField || segments.map((segment) => segment.text).join(" ")
  if (!text) {
    throw new Error("A transcrição voltou sem texto.")
  }

  if (segments.length === 0) {
    const duration = Math.max(0, finiteNumber(payload.duration, 0))
    segments.push({
      id: "seg-0",
      speakerLabel: "A",
      startSeconds: 0,
      endSeconds: duration,
      text,
    })
  }

  const durationSeconds =
    typeof payload.duration === "number" && Number.isFinite(payload.duration) ? payload.duration : null

  return { text, durationSeconds, segments }
}

export function speakerDraftsFromLabels(labels: readonly string[]): SpeakerDraft[] {
  const unique: string[] = []
  for (const label of labels) {
    if (label.length > 0 && !unique.includes(label)) {
      unique.push(label)
    }
  }
  return unique.map((label, index) => ({
    providerLabel: label,
    displayName: speakerDisplayName(index + 1),
    colorToken: speakerSwatch(index + 1).token,
    sortOrder: index,
    chunkIndex: 0,
  }))
}

export function secondsToMs(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0
  }
  return Math.round(seconds * 1000)
}
