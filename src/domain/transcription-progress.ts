import type { LocalChunk } from "@/domain/local-transcript"
import type { ProcessingStatus } from "@/domain/processing-status"

export const LOCAL_CHUNK_SECONDS = 30
export const LOCAL_CHUNK_STRIDE_SECONDS = 5

export function transcriptionPercent(audioFraction: number): number {
  const fraction = Math.min(1, Math.max(0, Number.isFinite(audioFraction) ? audioFraction : 0))
  return Math.round(10 + fraction * 82)
}

export function visiblePercent(status: ProcessingStatus, reported: number | null): number | null {
  if (status === "queued") {
    return 2
  }
  if (status === "preparing") {
    return 6
  }
  if (status === "identifying_speakers") {
    return 94
  }
  if (status === "saving") {
    return 97
  }
  if (status === "transcribing" && reported != null && Number.isFinite(reported)) {
    return Math.min(92, Math.max(10, Math.round(reported)))
  }
  return null
}

export const LOCAL_PROCESSING_FACTOR = 1.6

export function estimatedProgress(
  durationSeconds: number,
  startedAt: number,
  now: number,
): { percent: number; remaining: string } | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || !Number.isFinite(startedAt)) {
    return null
  }
  const expectedMs = durationSeconds * LOCAL_PROCESSING_FACTOR * 1000
  const elapsed = now - startedAt
  if (!Number.isFinite(elapsed) || elapsed < 0 || expectedMs <= 0) {
    return null
  }
  const percent = Math.min(92, Math.max(10, Math.round((elapsed / expectedMs) * 100)))
  const leftMs = expectedMs - elapsed
  if (leftMs <= 60_000) {
    return { percent, remaining: "faltam poucos minutos" }
  }
  const minutes = Math.round(leftMs / 60_000)
  const remaining = minutes <= 1 ? "falta cerca de 1 minuto" : `faltam cerca de ${minutes} minutos`
  return { percent, remaining }
}

export function progressRemainingPhrase(percent: number, startedAt: number, now: number): string | null {
  if (percent < 18 || percent >= 100) {
    return null
  }
  const elapsed = now - startedAt
  if (!Number.isFinite(elapsed) || elapsed < 20_000) {
    return null
  }
  const leftMs = elapsed * ((100 - percent) / percent)
  if (!Number.isFinite(leftMs) || leftMs < 0) {
    return null
  }
  const minutes = Math.round(leftMs / 60_000)
  if (minutes <= 1) {
    return "cerca de 1 minuto"
  }
  return `cerca de ${minutes} minutos`
}

export function selectSliceChunks(
  chunks: readonly LocalChunk[],
  sliceStartSeconds: number,
  sliceDurationSeconds: number,
  isFirst: boolean,
  isLast: boolean,
): LocalChunk[] {
  const left = isFirst ? 0 : LOCAL_CHUNK_STRIDE_SECONDS
  const right = isLast ? sliceDurationSeconds : LOCAL_CHUNK_SECONDS - LOCAL_CHUNK_STRIDE_SECONDS
  const inside = chunks.filter((chunk) => {
    const relative = chunk.startSeconds - sliceStartSeconds
    return relative >= left - 0.05 && relative < right - 0.01
  })
  if (inside.length > 0) {
    return inside
  }
  const overlapping = chunks.filter((chunk) => {
    const relativeStart = chunk.startSeconds - sliceStartSeconds
    const relativeEnd = (chunk.endSeconds ?? chunk.startSeconds) - sliceStartSeconds
    const midpoint = (relativeStart + relativeEnd) / 2
    return midpoint >= left && midpoint < right
  })
  if (overlapping.length > 0) {
    return overlapping
  }
  return isFirst ? [...chunks] : []
}
