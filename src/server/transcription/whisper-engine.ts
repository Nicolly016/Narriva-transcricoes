import "server-only"

import { availableParallelism } from "node:os"
import path from "node:path"
import { Worker } from "node:worker_threads"
import { LOCAL_SAMPLE_RATE, LOCAL_TRANSCRIPTION_LANGUAGE, LOCAL_TRANSCRIPTION_MODEL, type LocalChunk } from "@/domain/local-transcript"
import { LOCAL_CHUNK_SECONDS, LOCAL_CHUNK_STRIDE_SECONDS, selectSliceChunks } from "@/domain/transcription-progress"
import { TranscriptionStopped } from "@/server/transcription/stop"

type SliceChunk = { text: string; start: number | null; end: number | null }

type SliceResponse = {
  id: number
  text?: string
  chunks?: SliceChunk[]
  error?: string
}

type WhisperRuntime = {
  worker: Worker
  pending: Map<number, { resolve: (value: SliceResponse) => void; reject: (error: Error) => void }>
  nextId: number
  model: string
}

function whisperRuntime(): WhisperRuntime {
  const host = globalThis as typeof globalThis & { whisperRuntime?: WhisperRuntime }
  const current = host.whisperRuntime
  if (current?.model === LOCAL_TRANSCRIPTION_MODEL) {
    return current
  }
  if (current && current.pending.size === 0) {
    void current.worker.terminate()
    host.whisperRuntime = undefined
  } else if (current) {
    return current
  }
  const worker = new Worker(path.join(process.cwd(), "src", "server", "transcription", "whisper-worker.mjs"), {
    workerData: {
      cacheDir: path.join(process.cwd(), ".cache", "whisper"),
      model: LOCAL_TRANSCRIPTION_MODEL,
      language: LOCAL_TRANSCRIPTION_LANGUAGE,
      threads: Math.max(1, availableParallelism()),
    },
  })
  const pending = new Map<number, { resolve: (value: SliceResponse) => void; reject: (error: Error) => void }>()
  const runtime: WhisperRuntime = { worker, pending, nextId: 1, model: LOCAL_TRANSCRIPTION_MODEL }
  worker.on("message", (message: SliceResponse) => {
    const waiter = pending.get(message.id)
    if (!waiter) {
      return
    }
    pending.delete(message.id)
    if (message.error) {
      waiter.reject(new Error(message.error))
      return
    }
    waiter.resolve(message)
  })
  worker.on("error", (error) => {
    for (const waiter of pending.values()) {
      waiter.reject(error)
    }
    pending.clear()
    if (host.whisperRuntime?.worker === worker) {
      host.whisperRuntime = undefined
    }
  })
  host.whisperRuntime = runtime
  return runtime
}

function runSlice(pcm: Float32Array): Promise<SliceResponse> {
  const runtime = whisperRuntime()
  const id = runtime.nextId
  runtime.nextId += 1
  const copy = new Float32Array(pcm)
  return new Promise((resolve, reject) => {
    runtime.pending.set(id, { resolve, reject })
    runtime.worker.postMessage({ id, pcm: copy }, [copy.buffer])
  })
}

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

async function transcribeSlice(pcm: Float32Array, sliceStartSeconds: number): Promise<LocalChunk[]> {
  const output = await runSlice(pcm)
  const chunks = output.chunks ?? []
  if (chunks.length === 0 && output.text?.trim()) {
    return [{ text: output.text, startSeconds: sliceStartSeconds, endSeconds: null }]
  }
  return chunks.map((chunk) => ({
    text: chunk.text,
    startSeconds: sliceStartSeconds + finite(chunk.start, 0),
    endSeconds: chunk.end,
  }))
}

export type TranscribePcmOptions = {
  startOffset?: number
  pieces?: LocalChunk[]
  onProgress?: (audioFraction: number) => void
  onSlice?: (nextOffset: number, pieces: LocalChunk[]) => void
  shouldStop?: () => boolean
}

export async function transcribePcm(pcm: Float32Array, options: TranscribePcmOptions = {}): Promise<LocalChunk[]> {
  if (options.shouldStop?.()) {
    throw new TranscriptionStopped()
  }
  const windowSamples = LOCAL_CHUNK_SECONDS * LOCAL_SAMPLE_RATE
  const strideSamples = LOCAL_CHUNK_STRIDE_SECONDS * LOCAL_SAMPLE_RATE
  const jump = windowSamples - 2 * strideSamples
  const pieces = [...(options.pieces ?? [])]
  let offset = options.startOffset ?? 0
  if (offset < 0 || offset > pcm.length) {
    offset = 0
  }
  if (offset >= pcm.length) {
    options.onProgress?.(1)
    return pieces
  }

  const stop = () => {
    if (options.shouldStop?.()) {
      throw new TranscriptionStopped()
    }
  }

  if (pcm.length <= windowSamples) {
    stop()
    const sliceChunks = await transcribeSlice(pcm, 0)
    pieces.push(...selectSliceChunks(sliceChunks, 0, pcm.length / LOCAL_SAMPLE_RATE, true, true))
    options.onSlice?.(pcm.length, pieces)
    options.onProgress?.(1)
    return pieces
  }

  while (offset < pcm.length) {
    stop()
    const end = Math.min(pcm.length, offset + windowSamples)
    const slice = new Float32Array(pcm.subarray(offset, end))
    const isFirst = offset === 0
    const isLast = end >= pcm.length
    const sliceStartSeconds = offset / LOCAL_SAMPLE_RATE
    const sliceChunks = await transcribeSlice(slice, sliceStartSeconds)
    pieces.push(
      ...selectSliceChunks(sliceChunks, sliceStartSeconds, slice.length / LOCAL_SAMPLE_RATE, isFirst, isLast),
    )
    const nextOffset = isLast ? pcm.length : offset + jump
    options.onSlice?.(nextOffset, pieces)
    options.onProgress?.(end / pcm.length)
    if (isLast) {
      break
    }
    offset = nextOffset
  }
  return pieces
}
