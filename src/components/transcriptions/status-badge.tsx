"use client"

import { useLiveAudio } from "@/components/transcriptions/live-progress"
import { isPausedTranscription } from "@/domain/audio-pause"
import { isActiveProcessing, isProcessingStatus, PROCESSING_STATUS_LABELS } from "@/domain/processing-status"

function statusClass(status: string): string {
  if (status === "completed") {
    return "bg-primary text-primary-foreground"
  }
  if (status === "error") {
    return "bg-destructive text-white"
  }
  return "bg-warning text-warning-foreground"
}

export function StatusBadge({
  audioId,
  status,
  errorMessage = null,
}: {
  audioId: string
  status: string
  errorMessage?: string | null
}) {
  const paused = isPausedTranscription(status, errorMessage)
  const live = useLiveAudio(audioId)
  const current = !paused && live && isProcessingStatus(status) && isActiveProcessing(status) ? live.status : status
  const label = paused ? "Pausada" : isProcessingStatus(current) ? PROCESSING_STATUS_LABELS[current] : current

  return (
    <span className={`w-fit rounded-md px-2.5 py-1 text-sm font-semibold ${statusClass(paused ? "queued" : current)}`}>
      {label}
    </span>
  )
}
