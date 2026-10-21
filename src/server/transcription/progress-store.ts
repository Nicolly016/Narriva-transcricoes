import "server-only"

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

const AUDIO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type StoredProgress = {
  percent: number
  startedAt: number
}

function progressPath(audioId: string): string | null {
  if (!AUDIO_ID.test(audioId)) {
    return null
  }
  return path.join(process.cwd(), ".cache", "transcription-progress", `${audioId}.json`)
}

export function readTranscriptionProgress(audioId: string): StoredProgress | null {
  const file = progressPath(audioId)
  if (!file) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"))
    if (typeof parsed !== "object" || parsed === null) {
      return null
    }
    const percent = "percent" in parsed ? parsed.percent : null
    const startedAt = "startedAt" in parsed ? parsed.startedAt : null
    if (typeof percent !== "number" || !Number.isFinite(percent)) {
      return null
    }
    if (typeof startedAt !== "number" || !Number.isFinite(startedAt)) {
      return null
    }
    return { percent, startedAt }
  } catch {
    return null
  }
}

export function writeTranscriptionProgress(audioId: string, percent: number): void {
  const file = progressPath(audioId)
  if (!file || !Number.isFinite(percent)) {
    return
  }
  const next = Math.max(0, Math.min(100, Math.round(percent)))
  const current = readTranscriptionProgress(audioId)
  if (current && next <= current.percent) {
    return
  }
  const payload: StoredProgress = {
    percent: next,
    startedAt: current?.startedAt ?? Date.now(),
  }
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(payload))
}

export function clearTranscriptionProgress(audioId: string): void {
  const file = progressPath(audioId)
  if (!file) {
    return
  }
  rmSync(file, { force: true })
}
