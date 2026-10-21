import type { ProcessingStatus } from "@/domain/processing-status"

export const AUDIO_PAUSED_MESSAGE = "Transcrição pausada. O trecho já feito continua salvo."

const PAUSABLE: readonly ProcessingStatus[] = ["queued", "preparing", "transcribing"]

export function canPauseProcessing(status: ProcessingStatus): boolean {
  return PAUSABLE.includes(status)
}

export function isPausedTranscription(status: string, errorMessage: string | null): boolean {
  return status === "error" && errorMessage === AUDIO_PAUSED_MESSAGE
}
