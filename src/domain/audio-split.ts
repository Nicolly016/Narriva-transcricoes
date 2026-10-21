export const LONG_AUDIO_SPLIT_SECONDS = 20 * 60
export const LONG_AUDIO_SPLIT_BYTES = 12 * 1024 * 1024
export const SPLIT_PART_MINUTES = [10, 15, 20] as const
export const AUDIO_DIVIDED_MESSAGE = "Este áudio foi dividido em partes menores."

export type SplitPartMinutes = (typeof SPLIT_PART_MINUTES)[number]

export type AudioSlice = {
  startSeconds: number
  durationSeconds: number
}

export function isSplitPartMinutes(value: number): value is SplitPartMinutes {
  return (SPLIT_PART_MINUTES as readonly number[]).includes(value)
}

export function offersAudioSplit(
  status: string,
  durationSeconds: number | null,
  sizeBytes: number,
  errorMessage: string | null,
): boolean {
  if (status === "completed" || errorMessage === AUDIO_DIVIDED_MESSAGE) {
    return false
  }
  if (durationSeconds != null) {
    return durationSeconds >= LONG_AUDIO_SPLIT_SECONDS
  }
  return sizeBytes >= LONG_AUDIO_SPLIT_BYTES
}

export function splitRanges(durationSeconds: number, partSeconds: number): AudioSlice[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 1) {
    return []
  }
  if (!Number.isFinite(partSeconds) || partSeconds < 60) {
    return []
  }
  const ranges: AudioSlice[] = []
  let start = 0
  while (start < durationSeconds - 0.5) {
    const length = Math.min(partSeconds, durationSeconds - start)
    ranges.push({ startSeconds: start, durationSeconds: length })
    start += length
  }
  const last = ranges[ranges.length - 1]
  const previous = ranges[ranges.length - 2]
  if (last && previous && last.durationSeconds < 30) {
    previous.durationSeconds += last.durationSeconds
    ranges.pop()
  }
  return ranges
}

export function partTitle(title: string, index: number, total: number): string {
  const suffix = ` · parte ${index} de ${total}`
  const base = title.trim() || "Áudio"
  return `${base.slice(0, Math.max(1, 200 - suffix.length))}${suffix}`
}
