import "server-only"

import { secondsToMs, speakerDraftsFromLabels } from "@/domain/diarized-transcript"
import { transcriptionPercent } from "@/domain/transcription-progress"
import {
  canTransitionStatus,
  isProcessingStatus,
  type ProcessingStatus,
} from "@/domain/processing-status"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { clearTranscriptionProgress, writeTranscriptionProgress } from "@/server/transcription/progress-store"
import { createTranscriptionProvider } from "@/server/transcription/provider"
import { AUDIO_PAUSED_MESSAGE } from "@/domain/audio-pause"
import { clearTranscriptionCancel, isTranscriptionCancelled, requestTranscriptionCancel } from "@/server/transcription/cancel-flag"
import { clearTranscriptionPause, isTranscriptionPaused } from "@/server/transcription/pause-flag"
import { TranscriptionStopped } from "@/server/transcription/stop"
import {
  clearSliceCheckpoint,
  readSliceCheckpoint,
  writeSliceCheckpoint,
} from "@/server/transcription/slice-checkpoint"
import { AUDIO_DIVIDED_MESSAGE } from "@/domain/audio-split"

const workers = globalThis as typeof globalThis & {
  transcriptionJobsRunning?: Set<string>
  transcriptionResumeSweepAt?: number
  transcriptionChain?: Promise<void>
}

function runningJobs(): Set<string> {
  if (!workers.transcriptionJobsRunning) {
    workers.transcriptionJobsRunning = new Set()
  }
  return workers.transcriptionJobsRunning
}

type JobContext = {
  jobId: string
  audioId: string
  ownerId: string
  status: ProcessingStatus
}

function failureMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.slice(0, 500)
  }
  return "A transcrição falhou."
}

async function transition(
  admin: ReturnType<typeof createServiceRoleClient>,
  context: JobContext,
  to: ProcessingStatus,
  extra?: { error?: string | null; requestId?: string | null; durationSeconds?: number | null },
): Promise<void> {
  if (!canTransitionStatus(context.status, to)) {
    throw new Error("A etapa do processamento não pode avançar.")
  }
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from("transcription_jobs")
    .update({
      status: to,
      error_message: extra?.error ?? null,
      ...(to === "preparing" ? { started_at: now } : {}),
      ...(to === "completed" || to === "error" ? { finished_at: now } : {}),
      ...(extra?.requestId ? { provider_request_id: extra.requestId } : {}),
    })
    .eq("id", context.jobId)
    .eq("status", context.status)
    .select("id")
    .maybeSingle()
  if (error || !data) {
    throw new Error("O processamento foi interrompido.")
  }

  const { error: audioError } = await admin
    .from("audio_files")
    .update({
      status: to,
      error_message: extra?.error ?? null,
      ...(extra?.durationSeconds != null ? { duration_seconds: extra.durationSeconds } : {}),
    })
    .eq("id", context.audioId)
    .eq("owner_id", context.ownerId)
  if (audioError) {
    throw new Error("Não foi possível atualizar o áudio.")
  }
  context.status = to
}

export function resumeInterruptedTranscriptions(): void {
  const now = Date.now()
  if (workers.transcriptionResumeSweepAt != null && now - workers.transcriptionResumeSweepAt < 10_000) {
    return
  }
  workers.transcriptionResumeSweepAt = now
  void sweepInterruptedTranscriptions()
}

async function settlePaused(
  admin: ReturnType<typeof createServiceRoleClient>,
  context: JobContext,
): Promise<void> {
  const pausedAt = new Date().toISOString()
  await admin
    .from("audio_files")
    .update({ status: "error", error_message: AUDIO_PAUSED_MESSAGE })
    .eq("id", context.audioId)
    .eq("owner_id", context.ownerId)
    .in("status", ["queued", "preparing", "transcribing"])
  await admin
    .from("transcription_jobs")
    .update({ status: "error", error_message: AUDIO_PAUSED_MESSAGE, finished_at: pausedAt })
    .eq("id", context.jobId)
    .in("status", ["queued", "preparing", "transcribing"])
  clearTranscriptionPause(context.audioId)
}

async function sweepInterruptedTranscriptions(): Promise<void> {
  const admin = createServiceRoleClient()
  const { data: divided } = await admin.from("audio_files").select("id").eq("error_message", AUDIO_DIVIDED_MESSAGE)
  for (const audio of divided ?? []) {
    requestTranscriptionCancel(audio.id)
  }
  const { data } = await admin
    .from("transcription_jobs")
    .select("id, audio_file_id")
    .in("status", ["queued", "preparing", "transcribing"])
  for (const job of data ?? []) {
    if (isTranscriptionCancelled(job.audio_file_id) || isTranscriptionPaused(job.audio_file_id)) {
      continue
    }
    void runTranscriptionJob(job.id).catch(() => undefined)
  }
}

export async function runTranscriptionJob(jobId: string): Promise<void> {
  const running = runningJobs()
  if (running.has(jobId)) {
    return
  }
  running.add(jobId)
  const previous = workers.transcriptionChain ?? Promise.resolve()
  workers.transcriptionChain = previous.catch(() => undefined).then(async () => {
    try {
      await executeTranscriptionJob(jobId)
    } finally {
      running.delete(jobId)
    }
  })
  await workers.transcriptionChain
}

async function executeTranscriptionJob(jobId: string): Promise<void> {
  const admin = createServiceRoleClient()
  const { data: job, error } = await admin
    .from("transcription_jobs")
    .select("id, owner_id, audio_file_id, status, attempt_count, max_attempts, provider")
    .eq("id", jobId)
    .maybeSingle()
  if (error || !job || !isProcessingStatus(job.status)) {
    return
  }
  const interrupted = job.status === "preparing" || job.status === "transcribing"
  if (job.status !== "queued" && !interrupted) {
    return
  }
  if (!interrupted && job.attempt_count >= job.max_attempts) {
    await transition(
      admin,
      { jobId: job.id, audioId: job.audio_file_id, ownerId: job.owner_id, status: "queued" },
      "error",
      { error: "O número de tentativas desta transcrição se esgotou." },
    )
    return
  }

  if (!interrupted) {
    const { data: claimed, error: claimError } = await admin
      .from("transcription_jobs")
      .update({
        status: "preparing",
        attempt_count: job.attempt_count + 1,
        started_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", job.id)
      .eq("status", "queued")
      .eq("attempt_count", job.attempt_count)
      .select("id")
      .maybeSingle()
    if (claimError || !claimed) {
      return
    }
  }

  const context: JobContext = {
    jobId: job.id,
    audioId: job.audio_file_id,
    ownerId: job.owner_id,
    status: interrupted ? job.status : "preparing",
  }
  let saved = false

  try {
    if (!interrupted) {
      const { error: preparingError } = await admin
        .from("audio_files")
        .update({ status: "preparing", error_message: null })
        .eq("id", job.audio_file_id)
        .eq("owner_id", job.owner_id)
      if (preparingError) {
        throw new Error("Não foi possível atualizar o áudio.")
      }
      clearTranscriptionProgress(job.audio_file_id)
      writeTranscriptionProgress(job.audio_file_id, 6)
    }
    const { data: audio, error: audioError } = await admin
      .from("audio_files")
      .select("id, storage_path, mime_type, format, size_bytes, processing_authorized")
      .eq("id", job.audio_file_id)
      .eq("owner_id", job.owner_id)
      .maybeSingle()
    if (audioError || !audio) {
      throw new Error("O áudio não foi encontrado.")
    }
    if (!audio.processing_authorized) {
      throw new Error("A transcrição exige a confirmação de autorização.")
    }

    const { data: file, error: downloadError } = await admin.storage.from("audio").download(audio.storage_path)
    if (downloadError || !file) {
      throw new Error("Não foi possível ler o áudio no armazenamento.")
    }
    if (context.status !== "transcribing") {
      await transition(admin, context, "transcribing")
    }
    const savedSlices = readSliceCheckpoint(job.audio_file_id)
    if (!savedSlices) {
      clearTranscriptionProgress(job.audio_file_id)
      writeTranscriptionProgress(job.audio_file_id, 10)
    }
    const provider = createTranscriptionProvider()
    const result = await provider.transcribe({
      audio: new Uint8Array(await file.arrayBuffer()),
      resume: savedSlices,
      onSlice: (checkpoint) => {
        writeSliceCheckpoint(job.audio_file_id, checkpoint)
        writeTranscriptionProgress(
          job.audio_file_id,
          transcriptionPercent(checkpoint.nextOffset / checkpoint.pcmLength),
        )
      },
      onProgress: (audioFraction) => {
        writeTranscriptionProgress(job.audio_file_id, transcriptionPercent(audioFraction))
      },
      shouldStop: () => isTranscriptionCancelled(job.audio_file_id) || isTranscriptionPaused(job.audio_file_id),
    })
    writeTranscriptionProgress(job.audio_file_id, 94)
    await transition(admin, context, "identifying_speakers", { requestId: result.requestId })

    const drafts = speakerDraftsFromLabels(result.segments.map((segment) => segment.speakerLabel))
    writeTranscriptionProgress(job.audio_file_id, 97)
    await transition(admin, context, "saving")
    await admin.from("transcriptions").delete().eq("audio_file_id", audio.id).eq("owner_id", job.owner_id)

    const { data: transcription, error: transcriptionError } = await admin
      .from("transcriptions")
      .insert({
        owner_id: job.owner_id,
        audio_file_id: audio.id,
        language: result.language,
        provider: result.provider,
        model: result.model,
        original_full_text: result.text,
        audio_was_split: result.speakerLabelsAreChunkLocal,
        split_limitation_note: result.limitations.length > 0 ? result.limitations.join(" ") : null,
      })
      .select("id")
      .single()
    if (transcriptionError || !transcription) {
      throw new Error("Não foi possível salvar a transcrição.")
    }

    const { data: speakers, error: speakerError } = await admin
      .from("speakers")
      .insert(
        drafts.map((draft) => ({
          owner_id: job.owner_id,
          transcription_id: transcription.id,
          provider_label: draft.providerLabel,
          chunk_index: draft.chunkIndex,
          display_name: draft.displayName,
          color_token: draft.colorToken,
          sort_order: draft.sortOrder,
        })),
      )
      .select("id, provider_label")
    if (speakerError || !speakers || speakers.length !== drafts.length) {
      throw new Error("Não foi possível salvar os participantes.")
    }
    const speakerIds = new Map(speakers.map((speaker) => [speaker.provider_label, speaker.id]))

    const { error: segmentError } = await admin.from("transcription_segments").insert(
      result.segments.map((segment, index) => {
        const speakerId = speakerIds.get(segment.speakerLabel) ?? null
        return {
          owner_id: job.owner_id,
          transcription_id: transcription.id,
          speaker_id: speakerId,
          original_speaker_id: speakerId,
          segment_index: index,
          chunk_index: 0,
          start_ms: secondsToMs(segment.startSeconds),
          end_ms: secondsToMs(segment.endSeconds),
          original_text: segment.text,
          text: segment.text,
        }
      }),
    )
    if (segmentError) {
      throw new Error("Não foi possível salvar os trechos.")
    }

    await transition(admin, context, "completed", {
      requestId: result.requestId,
      durationSeconds: result.durationSeconds,
    })
    clearTranscriptionProgress(context.audioId)
    clearSliceCheckpoint(context.audioId)
    saved = true
  } catch (caught) {
    if (saved) {
      return
    }
    if (isTranscriptionCancelled(context.audioId)) {
      clearTranscriptionProgress(context.audioId)
      clearSliceCheckpoint(context.audioId)
      clearTranscriptionCancel(context.audioId)
      if (canTransitionStatus(context.status, "error")) {
        await transition(admin, context, "error", { error: AUDIO_DIVIDED_MESSAGE }).catch(() => undefined)
      }
      return
    }
    if (
      isTranscriptionPaused(context.audioId) ||
      (caught instanceof Error && caught.message === AUDIO_PAUSED_MESSAGE)
    ) {
      await settlePaused(admin, context)
      return
    }
    if (caught instanceof TranscriptionStopped) {
      clearTranscriptionProgress(context.audioId)
      clearSliceCheckpoint(context.audioId)
      clearTranscriptionCancel(context.audioId)
      if (canTransitionStatus(context.status, "error")) {
        await transition(admin, context, "error", { error: AUDIO_DIVIDED_MESSAGE }).catch(() => undefined)
      }
      return
    }
    const message = failureMessage(caught)
    if (canTransitionStatus(context.status, "error")) {
      await transition(admin, context, "error", { error: message }).catch(() => undefined)
    }
    clearTranscriptionProgress(context.audioId)
    await admin.from("transcriptions").delete().eq("audio_file_id", context.audioId).eq("owner_id", context.ownerId)
  }
}
