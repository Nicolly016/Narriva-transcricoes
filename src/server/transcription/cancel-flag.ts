import "server-only"

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

const AUDIO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function cancelPath(audioId: string): string | null {
  if (!AUDIO_ID.test(audioId)) {
    return null
  }
  return path.join(process.cwd(), ".cache", "transcription-cancel", audioId)
}

export function requestTranscriptionCancel(audioId: string): void {
  const file = cancelPath(audioId)
  if (!file) {
    return
  }
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, "1")
}

export function isTranscriptionCancelled(audioId: string): boolean {
  const file = cancelPath(audioId)
  if (!file) {
    return false
  }
  try {
    readFileSync(file)
    return true
  } catch {
    return false
  }
}

export function clearTranscriptionCancel(audioId: string): void {
  const file = cancelPath(audioId)
  if (!file) {
    return
  }
  rmSync(file, { force: true })
}
