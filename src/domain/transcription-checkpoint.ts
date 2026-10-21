import type { LocalChunk } from "@/domain/local-transcript"

export type SliceCheckpoint = {
  pcmLength: number
  nextOffset: number
  pieces: LocalChunk[]
}

function chunk(value: unknown): LocalChunk | null {
  if (typeof value !== "object" || value === null) {
    return null
  }
  const record = value as Record<string, unknown>
  if (typeof record.text !== "string") {
    return null
  }
  if (typeof record.startSeconds !== "number" || !Number.isFinite(record.startSeconds)) {
    return null
  }
  if (record.endSeconds !== null && (typeof record.endSeconds !== "number" || !Number.isFinite(record.endSeconds))) {
    return null
  }
  return {
    text: record.text,
    startSeconds: record.startSeconds,
    endSeconds: record.endSeconds,
  }
}

export function parseSliceCheckpoint(value: unknown): SliceCheckpoint | null {
  if (typeof value !== "object" || value === null) {
    return null
  }
  const record = value as Record<string, unknown>
  if (typeof record.pcmLength !== "number" || !Number.isInteger(record.pcmLength) || record.pcmLength < 1) {
    return null
  }
  if (
    typeof record.nextOffset !== "number" ||
    !Number.isInteger(record.nextOffset) ||
    record.nextOffset < 0 ||
    record.nextOffset > record.pcmLength
  ) {
    return null
  }
  if (!Array.isArray(record.pieces)) {
    return null
  }
  const pieces: LocalChunk[] = []
  for (const item of record.pieces) {
    const parsed = chunk(item)
    if (!parsed) {
      return null
    }
    pieces.push(parsed)
  }
  return { pcmLength: record.pcmLength, nextOffset: record.nextOffset, pieces }
}

export function usableSliceCheckpoint(saved: SliceCheckpoint | null, pcmLength: number): SliceCheckpoint | null {
  if (!saved || saved.pcmLength !== pcmLength) {
    return null
  }
  return saved
}
