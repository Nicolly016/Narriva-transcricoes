export const PROCESSING_STATUSES = [
  "uploaded",
  "queued",
  "preparing",
  "transcribing",
  "identifying_speakers",
  "saving",
  "completed",
  "error",
] as const

export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number]

export const PROCESSING_STATUS_LABELS: Record<ProcessingStatus, string> = {
  uploaded: "Arquivo enviado",
  queued: "Aguardando processamento",
  preparing: "Preparando áudio",
  transcribing: "Transcrevendo",
  identifying_speakers: "Identificando participantes",
  saving: "Salvando resultados",
  completed: "Concluído",
  error: "Erro",
}

const FORWARD: Record<Exclude<ProcessingStatus, "completed" | "error">, ProcessingStatus> = {
  uploaded: "queued",
  queued: "preparing",
  preparing: "transcribing",
  transcribing: "identifying_speakers",
  identifying_speakers: "saving",
  saving: "completed",
}

export function isProcessingStatus(value: string): value is ProcessingStatus {
  return (PROCESSING_STATUSES as readonly string[]).includes(value)
}

export function canRetryProcessing(status: ProcessingStatus): boolean {
  return status === "error"
}

export function canReloadTranscription(status: ProcessingStatus): boolean {
  return status === "completed"
}

export function isActiveProcessing(status: ProcessingStatus): boolean {
  return status !== "uploaded" && status !== "completed" && status !== "error"
}

export const ACTIVE_PROCESSING_STATUSES: ProcessingStatus[] = PROCESSING_STATUSES.filter((status) =>
  isActiveProcessing(status),
)

export function activeAudioFinished(renderedIds: readonly string[], activeIds: readonly string[]): boolean {
  if (renderedIds.length === 0) {
    return false
  }
  const active = new Set(activeIds)
  return renderedIds.some((id) => !active.has(id))
}

export function canTransitionStatus(from: ProcessingStatus, to: ProcessingStatus): boolean {
  if (from === to) {
    return true
  }
  if (to === "error" && from !== "completed") {
    return true
  }
  if (from === "error" && to === "queued") {
    return true
  }
  if (from === "completed" || from === "error") {
    return false
  }
  return FORWARD[from] === to
}
