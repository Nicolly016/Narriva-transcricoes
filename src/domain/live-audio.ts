import { isProcessingStatus, type ProcessingStatus } from "@/domain/processing-status"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type LiveAudio = {
  id: string
  status: ProcessingStatus
  progressPercent: number | null
  progressStartedAt: number | null
  durationSeconds: number | null
  jobStartedAt: number | null
}

function numberOrNull(value: unknown): number | null | undefined {
  if (value === null) {
    return null
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  return undefined
}

export function parseLiveAudio(value: unknown): LiveAudio | null {
  if (typeof value !== "object" || value === null) {
    return null
  }
  const record = value as Record<string, unknown>
  if (typeof record.id !== "string" || !UUID.test(record.id)) {
    return null
  }
  if (typeof record.status !== "string" || !isProcessingStatus(record.status)) {
    return null
  }
  const progressPercent = numberOrNull(record.progressPercent)
  const progressStartedAt = numberOrNull(record.progressStartedAt)
  const durationSeconds = numberOrNull(record.durationSeconds)
  const jobStartedAt = numberOrNull(record.jobStartedAt)
  if (
    progressPercent === undefined ||
    progressStartedAt === undefined ||
    durationSeconds === undefined ||
    jobStartedAt === undefined
  ) {
    return null
  }
  return {
    id: record.id,
    status: record.status,
    progressPercent,
    progressStartedAt,
    durationSeconds,
    jobStartedAt,
  }
}

export function parseLiveAudioResponse(value: unknown): LiveAudio[] | null {
  if (typeof value !== "object" || value === null || !("items" in value) || !Array.isArray(value.items)) {
    return null
  }
  const items: LiveAudio[] = []
  for (const item of value.items) {
    const parsed = parseLiveAudio(item)
    if (!parsed) {
      return null
    }
    items.push(parsed)
  }
  return items
}
