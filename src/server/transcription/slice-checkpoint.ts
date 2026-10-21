import "server-only"

import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { AUDIO_PAUSED_MESSAGE } from "@/domain/audio-pause"
import { parseSliceCheckpoint, type SliceCheckpoint } from "@/domain/transcription-checkpoint"
import { isTranscriptionCancelled } from "@/server/transcription/cancel-flag"
import { isTranscriptionPaused } from "@/server/transcription/pause-flag"
import { TranscriptionStopped } from "@/server/transcription/stop"

const AUDIO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function checkpointPath(audioId: string): string | null {
  if (!AUDIO_ID.test(audioId)) {
    return null
  }
  return path.join(process.cwd(), ".cache", "transcription-slices", `${audioId}.json`)
}

export function readSliceCheckpoint(audioId: string): SliceCheckpoint | null {
  const file = checkpointPath(audioId)
  if (!file) {
    return null
  }
  try {
    return parseSliceCheckpoint(JSON.parse(readFileSync(file, "utf8")))
  } catch {
    return null
  }
}

export function writeSliceCheckpoint(audioId: string, checkpoint: SliceCheckpoint): void {
  if (isTranscriptionPaused(audioId)) {
    throw new Error(AUDIO_PAUSED_MESSAGE)
  }
  if (isTranscriptionCancelled(audioId)) {
    throw new TranscriptionStopped()
  }
  const file = checkpointPath(audioId)
  if (!file) {
    return
  }
  const directory = path.dirname(file)
  mkdirSync(directory, { recursive: true })
  const temporary = path.join(directory, `${audioId}.json.tmp`)
  writeFileSync(temporary, JSON.stringify(checkpoint))
  try {
    rmSync(file, { force: true })
    renameSync(temporary, file)
  } catch {
    rmSync(temporary, { force: true })
  }
}

export function clearSliceCheckpoint(audioId: string): void {
  const file = checkpointPath(audioId)
  if (!file) {
    return
  }
  rmSync(file, { force: true })
  rmSync(`${file}.tmp`, { force: true })
}
