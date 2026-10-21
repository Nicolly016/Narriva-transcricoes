import "server-only"

import {
  LOCAL_SAMPLE_RATE,
  LOCAL_STORED_LANGUAGE,
  LOCAL_TRANSCRIPTION_MODEL,
  LOCAL_TRANSCRIPTION_NOTE,
  transcriptFromChunks,
} from "@/domain/local-transcript"
import type { SliceCheckpoint } from "@/domain/transcription-checkpoint"
import { usableSliceCheckpoint } from "@/domain/transcription-checkpoint"
import { assignSpeakerLabels } from "@/domain/speaker-diarization"
import { decodeAudioToMonoPcm } from "@/server/transcription/decode-audio"
import { transcribePcm } from "@/server/transcription/whisper-engine"

export type TranscriptionRequest = {
  audio: Uint8Array
  resume?: SliceCheckpoint | null
  onSlice?: (checkpoint: SliceCheckpoint) => void
  onProgress?: (audioFraction: number) => void
  shouldStop?: () => boolean
}

export type DiarizedSegment = {
  id: string
  speakerLabel: string
  startSeconds: number
  endSeconds: number
  text: string
}

export type TranscriptionResult = {
  provider: "local"
  model: string
  language: string
  durationSeconds: number
  text: string
  segments: DiarizedSegment[]
  speakerLabelsAreChunkLocal: boolean
  limitations: string[]
  requestId: string | null
}

export interface TranscriptionProvider {
  readonly id: "local"
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>
}

export function createTranscriptionProvider(): TranscriptionProvider {
  return {
    id: "local",
    async transcribe(request) {
      const pcm = await decodeAudioToMonoPcm(request.audio)
      const resume = usableSliceCheckpoint(request.resume ?? null, pcm.length)
      const chunks = await transcribePcm(pcm, {
        startOffset: resume?.nextOffset,
        pieces: resume?.pieces,
        onProgress: request.onProgress,
        shouldStop: request.shouldStop,
        onSlice: (nextOffset, pieces) => {
          request.onSlice?.({ pcmLength: pcm.length, nextOffset, pieces })
        },
      })
      const transcript = transcriptFromChunks(chunks, pcm.length / LOCAL_SAMPLE_RATE)
      const segments = assignSpeakerLabels(pcm, LOCAL_SAMPLE_RATE, transcript.segments)
      return {
        provider: "local",
        model: LOCAL_TRANSCRIPTION_MODEL,
        language: LOCAL_STORED_LANGUAGE,
        durationSeconds: transcript.durationSeconds,
        text: transcript.text,
        segments,
        speakerLabelsAreChunkLocal: false,
        limitations: [LOCAL_TRANSCRIPTION_NOTE],
        requestId: null,
      }
    },
  }
}
