export const LOCAL_TRANSCRIPTION_MODEL = "Xenova/whisper-medium"
export const LOCAL_TRANSCRIPTION_LANGUAGE = "portuguese"
export const LOCAL_STORED_LANGUAGE = "pt"
export const LOCAL_SPEAKER_LABEL = "A"
export const LOCAL_SAMPLE_RATE = 16_000
export const LOCAL_MAX_DURATION_SECONDS = 2 * 60 * 60
export const LOCAL_TRANSCRIPTION_NOTE =
  "As vozes foram separadas pelo som deste áudio. Cada nome é um rótulo e pode ser trocado."

export type LocalChunk = {
  text: string
  startSeconds: number
  endSeconds: number | null
}

export type LocalTranscriptSegment = {
  id: string
  speakerLabel: string
  startSeconds: number
  endSeconds: number
  text: string
}

export type LocalTranscript = {
  text: string
  durationSeconds: number
  segments: LocalTranscriptSegment[]
}

export function durationLimitError(durationSeconds: number): string | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0.1) {
    return "O áudio não tem duração suficiente para transcrever."
  }
  if (durationSeconds > LOCAL_MAX_DURATION_SECONDS) {
    return "O áudio passa de 2 horas. Envie um trecho menor."
  }
  return null
}

export function collapseRepeatedSpeech(text: string): string {
  let current = text.replace(/\s+/g, " ").trim()
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const next = current.replace(/\b((?:\S+\s+){0,6}\S+[.?!…]?)(?:\s+\1){3,}/giu, "$1")
    if (next === current) {
      return current
    }
    current = next
  }
  return current
}

export function transcriptFromChunks(chunks: readonly LocalChunk[], durationSeconds: number): LocalTranscript {
  const limit = durationLimitError(durationSeconds)
  if (limit) {
    throw new Error(limit)
  }

  const segments: LocalTranscriptSegment[] = []
  chunks.forEach((chunk, index) => {
    const text = collapseRepeatedSpeech(chunk.text)
    if (!text) {
      return
    }
    const start = Math.max(0, Math.min(durationSeconds, chunk.startSeconds))
    const rawEnd = chunk.endSeconds ?? durationSeconds
    const end = Math.max(start, Math.min(durationSeconds, rawEnd))
    segments.push({
      id: `seg-${index}`,
      speakerLabel: LOCAL_SPEAKER_LABEL,
      startSeconds: start,
      endSeconds: end,
      text,
    })
  })

  const text = segments.map((segment) => segment.text).join(" ")
  if (!text) {
    throw new Error("A transcrição voltou sem texto.")
  }

  return { text, durationSeconds, segments }
}
