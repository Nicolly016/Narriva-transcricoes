"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import {
  extensionFromFilename,
  mimeTypeForExtension,
  sanitizeOriginalFilename,
  uploadSizeError,
} from "@/domain/audio-file"
import { AUDIO_DIVIDED_MESSAGE, isSplitPartMinutes, partTitle } from "@/domain/audio-split"
import { AUDIO_PAUSED_MESSAGE, canPauseProcessing, isPausedTranscription } from "@/domain/audio-pause"
import { formatClock } from "@/domain/captions"
import { canReloadTranscription, canRetryProcessing, isProcessingStatus } from "@/domain/processing-status"
import { buildAudioStoragePath, ACCEPTED_AUDIO_LABEL, isAcceptedAudioExtension, type AcceptedAudioExtension } from "@/domain/storage-path"
import { getCurrentUser } from "@/server/auth/current-user"
import { scheduleTranscription } from "@/server/jobs/queue"
import { clearTranscriptionCancel, requestTranscriptionCancel } from "@/server/transcription/cancel-flag"
import { clearTranscriptionPause, requestTranscriptionPause } from "@/server/transcription/pause-flag"
import { clearTranscriptionProgress } from "@/server/transcription/progress-store"
import { clearSliceCheckpoint, readSliceCheckpoint } from "@/server/transcription/slice-checkpoint"
import { splitAudioBytes } from "@/server/transcription/split-audio"
import { createClient } from "@/lib/supabase/server"

const registerSchema = z.object({
  projectId: z.uuid().nullable(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000),
  authorized: z.literal("sim"),
})

export type AudioActionState = { error: string | null; audioId?: string }

function revalidateAudioPaths(audioId?: string) {
  revalidatePath("/")
  revalidatePath("/importar")
  revalidatePath("/transcricoes")
  revalidatePath("/nuvem")
  revalidatePath("/analises")
  revalidatePath("/relatorios")
  if (audioId) {
    revalidatePath(`/transcricoes/${audioId}`)
  }
}

function importError(message: string): never {
  redirect(`/importar?error=${encodeURIComponent(message)}`)
}

function titleFromUpload(formData: FormData, file: File): string {
  const typed = formData.get("title")
  const raw = typeof typed === "string" ? typed.trim() : ""
  const fallback = file.name.replace(/\.[^.]+$/, "").trim()
  return (raw || fallback || "Áudio").slice(0, 200)
}

function storageUploadMessage(message: string): string {
  const text = message.toLowerCase()
  if (text.includes("mime")) {
    return "O armazenamento não aceitou o tipo deste arquivo. Use " + ACCEPTED_AUDIO_LABEL + "."
  }
  if (text.includes("unauthorized") || text.includes("row-level security") || text.includes("jwt")) {
    return "O armazenamento recusou o envio desta conta. Saia, entre de novo e repita a importação."
  }
  if (text.includes("bucket")) {
    return "O bucket de áudio não está disponível. Aplique a migração do banco."
  }
  if (text.includes("exceeded") || text.includes("too large") || text.includes("payload")) {
    return "O arquivo passa do limite de 500 MB do armazenamento."
  }
  return "Não foi possível enviar o arquivo para o armazenamento privado."
}

export async function registerAudio(formData: FormData): Promise<void> {
  const uploaded = formData.get("file")
  if (!(uploaded instanceof File)) {
    importError("Escolha um arquivo de áudio.")
  }
  const format = extensionFromFilename(uploaded.name)
  if (!format) {
    importError(`Use ${ACCEPTED_AUDIO_LABEL}.`)
  }
  const sizeError = uploadSizeError(uploaded.size)
  if (sizeError) {
    importError(sizeError)
  }

  const projectField = formData.get("projectId")
  const parsed = registerSchema.safeParse({
    projectId: typeof projectField === "string" && projectField.length > 0 ? projectField : null,
    title: titleFromUpload(formData, uploaded),
    description: formData.get("description") ?? "",
    authorized: formData.get("authorized"),
  })
  if (!parsed.success) {
    importError("Confira o arquivo, o título e a autorização antes de importar.")
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    importError("Defina SUPABASE_SERVICE_ROLE_KEY no servidor para processar a transcrição.")
  }

  const user = await getCurrentUser()
  const supabase = await createClient()
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) {
    importError("A sessão não autorizou o envio. Saia, entre de novo e repita a importação.")
  }
  if (parsed.data.projectId) {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", parsed.data.projectId)
      .eq("owner_id", user.id)
      .maybeSingle()
    if (projectError || !project) {
      importError("O projeto escolhido não pertence a esta conta.")
    }
  }

  const bytes = new Uint8Array(await uploaded.arrayBuffer())
  if (formData.get("splitLong") === "sim") {
    let outcome: "split" | "single"
    try {
      outcome = await importLongAudioAsParts({
        supabase,
        userId: user.id,
        projectId: parsed.data.projectId,
        title: parsed.data.title,
        format,
        bytes,
        partSeconds: 15 * 60,
      })
    } catch (caught) {
      importError(caught instanceof Error ? caught.message : "Não foi possível dividir o áudio.")
    }
    if (outcome === "split") {
      revalidateAudioPaths()
      redirect("/transcricoes")
    }
  }

  const audioId = crypto.randomUUID()
  const storagePath = buildAudioStoragePath(user.id, audioId, format)
  const mimeType = mimeTypeForExtension(format)
  const { error: uploadError } = await supabase.storage.from("audio").upload(storagePath, bytes, {
    contentType: mimeType,
    upsert: false,
  })
  if (uploadError) {
    console.error(uploadError.message)
    importError(storageUploadMessage(uploadError.message))
  }

  const { error: insertError } = await supabase.from("audio_files").insert({
    id: audioId,
    owner_id: user.id,
    project_id: parsed.data.projectId,
    title: parsed.data.title,
    description: parsed.data.description,
    original_filename: sanitizeOriginalFilename(uploaded.name),
    storage_path: storagePath,
    mime_type: mimeType,
    format,
    size_bytes: uploaded.size,
    status: "queued",
    error_message: null,
    processing_authorized: true,
  })
  if (insertError) {
    console.error(insertError.message)
    await supabase.storage.from("audio").remove([storagePath])
    importError("Não foi possível registrar o áudio. Confirme se a migração do banco foi aplicada.")
  }

  const { data: job, error: jobError } = await supabase
    .from("transcription_jobs")
    .insert({
      owner_id: user.id,
      audio_file_id: audioId,
      status: "queued",
      provider: "local",
      idempotency_key: "primary",
    })
    .select("id")
    .single()
  if (jobError || !job) {
    console.error(jobError?.message ?? "A tarefa de transcrição não foi criada.")
    await supabase.from("audio_files").update({
      status: "error",
      error_message: "Não foi possível criar a tarefa de transcrição.",
    }).eq("id", audioId).eq("owner_id", user.id)
    revalidateAudioPaths(audioId)
    redirect(`/transcricoes/${audioId}`)
  }

  scheduleTranscription(job.id)
  revalidateAudioPaths(audioId)
  redirect(`/transcricoes/${audioId}`)
}

export async function retryTranscription(
  _previous: AudioActionState,
  formData: FormData,
): Promise<AudioActionState> {
  const audioId = z.uuid().safeParse(formData.get("audioId"))
  if (!audioId.success) {
    return { error: "Áudio inválido." }
  }
  const user = await getCurrentUser()
  const supabase = await createClient()
  const { data: audio, error: audioError } = await supabase
    .from("audio_files")
    .select("id, status")
    .eq("id", audioId.data)
    .eq("owner_id", user.id)
    .maybeSingle()
  if (audioError || !audio || !isProcessingStatus(audio.status) || !canRetryProcessing(audio.status)) {
    return { error: "Este áudio não pode ser processado de novo." }
  }
  const { data: job, error: jobError } = await supabase
    .from("transcription_jobs")
    .select("id")
    .eq("audio_file_id", audio.id)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (jobError || !job) {
    return { error: "Não há uma tarefa de transcrição para retomar." }
  }

  const { error: resetJobError } = await supabase
    .from("transcription_jobs")
    .update({
      status: "queued",
      provider: "local",
      attempt_count: 0,
      error_message: null,
      finished_at: null,
    })
    .eq("id", job.id)
    .eq("owner_id", user.id)
  const { error: resetAudioError } = await supabase
    .from("audio_files")
    .update({ status: "queued", error_message: null })
    .eq("id", audio.id)
    .eq("owner_id", user.id)
  if (resetJobError || resetAudioError) {
    return { error: "Não foi possível reiniciar a transcrição." }
  }

  scheduleTranscription(job.id)
  revalidateAudioPaths(audio.id)
  return { error: null }
}

export async function reloadTranscription(
  _previous: AudioActionState,
  formData: FormData,
): Promise<AudioActionState> {
  const audioId = z.uuid().safeParse(formData.get("audioId"))
  if (!audioId.success) {
    return { error: "Áudio inválido." }
  }
  const user = await getCurrentUser()
  const supabase = await createClient()
  const { data: audio, error: audioError } = await supabase
    .from("audio_files")
    .select("id, status")
    .eq("id", audioId.data)
    .eq("owner_id", user.id)
    .maybeSingle()
  if (audioError || !audio || !isProcessingStatus(audio.status) || !canReloadTranscription(audio.status)) {
    return { error: "Este áudio não pode ser recarregado." }
  }
  const { data: job, error: jobError } = await supabase
    .from("transcription_jobs")
    .select("id")
    .eq("audio_file_id", audio.id)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (jobError || !job) {
    return { error: "Não há uma tarefa de transcrição para recarregar." }
  }

  clearSliceCheckpoint(audio.id)
  clearTranscriptionProgress(audio.id)
  clearTranscriptionCancel(audio.id)
  clearTranscriptionPause(audio.id)

  const { error: resetJobError } = await supabase
    .from("transcription_jobs")
    .update({
      status: "queued",
      provider: "local",
      attempt_count: 0,
      error_message: null,
      finished_at: null,
    })
    .eq("id", job.id)
    .eq("owner_id", user.id)
  const { error: resetAudioError } = await supabase
    .from("audio_files")
    .update({ status: "queued", error_message: null })
    .eq("id", audio.id)
    .eq("owner_id", user.id)
  if (resetJobError || resetAudioError) {
    return { error: "Não foi possível recarregar a transcrição." }
  }

  scheduleTranscription(job.id)
  revalidateAudioPaths(audio.id)
  return { error: null }
}

export async function pauseTranscription(
  _previous: AudioActionState,
  formData: FormData,
): Promise<AudioActionState> {
  const audioId = z.uuid().safeParse(formData.get("audioId"))
  if (!audioId.success) {
    return { error: "Áudio inválido." }
  }
  const user = await getCurrentUser()
  const supabase = await createClient()
  const { data: audio, error: audioError } = await supabase
    .from("audio_files")
    .select("id, status")
    .eq("id", audioId.data)
    .eq("owner_id", user.id)
    .maybeSingle()
  if (audioError || !audio || !isProcessingStatus(audio.status) || !canPauseProcessing(audio.status)) {
    return { error: "Esta transcrição não pode ser pausada agora." }
  }
  requestTranscriptionPause(audio.id)
  const { error: jobError } = await supabase
    .from("transcription_jobs")
    .update({
      status: "error",
      error_message: AUDIO_PAUSED_MESSAGE,
      finished_at: new Date().toISOString(),
    })
    .eq("audio_file_id", audio.id)
    .eq("owner_id", user.id)
    .in("status", ["queued", "preparing", "transcribing"])
  const { error: pauseError } = await supabase
    .from("audio_files")
    .update({ status: "error", error_message: AUDIO_PAUSED_MESSAGE })
    .eq("id", audio.id)
    .eq("owner_id", user.id)
    .in("status", ["queued", "preparing", "transcribing"])
  if (jobError || pauseError) {
    clearTranscriptionPause(audio.id)
    return { error: "Não foi possível pausar a transcrição." }
  }
  revalidateAudioPaths(audio.id)
  return { error: null }
}

export async function resumePausedTranscription(
  _previous: AudioActionState,
  formData: FormData,
): Promise<AudioActionState> {
  const audioId = z.uuid().safeParse(formData.get("audioId"))
  if (!audioId.success) {
    return { error: "Áudio inválido." }
  }
  const user = await getCurrentUser()
  const supabase = await createClient()
  const { data: audio, error: audioError } = await supabase
    .from("audio_files")
    .select("id, status, error_message")
    .eq("id", audioId.data)
    .eq("owner_id", user.id)
    .maybeSingle()
  if (audioError || !audio || !isPausedTranscription(audio.status, audio.error_message)) {
    return { error: "Esta transcrição não está pausada." }
  }
  const { data: job, error: jobError } = await supabase
    .from("transcription_jobs")
    .select("id")
    .eq("audio_file_id", audio.id)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (jobError || !job) {
    return { error: "Não há uma tarefa de transcrição para continuar." }
  }
  clearTranscriptionPause(audio.id)
  const nextStatus = readSliceCheckpoint(audio.id) ? "transcribing" : "queued"
  const { error: resetJobError } = await supabase
    .from("transcription_jobs")
    .update({
      status: nextStatus,
      error_message: null,
      finished_at: null,
    })
    .eq("id", job.id)
    .eq("owner_id", user.id)
  const { error: resetAudioError } = await supabase
    .from("audio_files")
    .update({ status: nextStatus, error_message: null })
    .eq("id", audio.id)
    .eq("owner_id", user.id)
  if (resetJobError || resetAudioError) {
    return { error: "Não foi possível continuar a transcrição." }
  }
  scheduleTranscription(job.id)
  revalidateAudioPaths(audio.id)
  return { error: null }
}

export async function deleteAudio(
  _previous: AudioActionState,
  formData: FormData,
): Promise<AudioActionState> {
  const audioId = z.uuid().safeParse(formData.get("audioId"))
  if (!audioId.success) {
    return { error: "Áudio inválido." }
  }
  const user = await getCurrentUser()
  const supabase = await createClient()
  const { data: audio, error: audioError } = await supabase
    .from("audio_files")
    .select("id, storage_path")
    .eq("id", audioId.data)
    .eq("owner_id", user.id)
    .maybeSingle()
  if (audioError || !audio) {
    return { error: "O áudio não foi encontrado." }
  }

  const { error: storageError } = await supabase.storage.from("audio").remove([audio.storage_path])
  if (storageError) {
    return { error: "Não foi possível apagar o arquivo do armazenamento." }
  }
  const { error: deleteError } = await supabase.from("audio_files").delete().eq("id", audio.id).eq("owner_id", user.id)
  if (deleteError) {
    return { error: "O arquivo saiu do armazenamento, mas o registro não foi excluído." }
  }
  clearTranscriptionProgress(audio.id)
  clearSliceCheckpoint(audio.id)
  clearTranscriptionCancel(audio.id)
  clearTranscriptionPause(audio.id)
  revalidateAudioPaths()
  redirect("/transcricoes")
}

type AudioStore = Awaited<ReturnType<typeof createClient>>

async function importLongAudioAsParts(input: {
  supabase: AudioStore
  userId: string
  projectId: string | null
  title: string
  format: AcceptedAudioExtension
  bytes: Uint8Array
  partSeconds: number
}): Promise<"split" | "single"> {
  let split: Awaited<ReturnType<typeof splitAudioBytes>>
  try {
    split = await splitAudioBytes(input.bytes, input.format, input.partSeconds)
  } catch (caught) {
    if (caught instanceof Error && caught.message === "Este áudio cabe em uma parte só.") {
      return "single"
    }
    throw caught instanceof Error ? caught : new Error("Não foi possível dividir o áudio.")
  }
  await storeAudioParts(input.supabase, {
    userId: input.userId,
    projectId: input.projectId,
    title: input.title,
    format: input.format,
    parts: split.parts,
  })
  return "split"
}

async function storeAudioParts(
  supabase: AudioStore,
  input: {
    userId: string
    projectId: string | null
    title: string
    format: AcceptedAudioExtension
    parts: Awaited<ReturnType<typeof splitAudioBytes>>["parts"]
  },
): Promise<string[]> {
  const created: { audioId: string; storagePath: string; jobId: string }[] = []
  try {
    for (let index = 0; index < input.parts.length; index += 1) {
      const part = input.parts[index]
      if (!part) {
        continue
      }
      const audioId = crypto.randomUUID()
      const storagePath = buildAudioStoragePath(input.userId, audioId, input.format)
      const mimeType = mimeTypeForExtension(input.format)
      const { error: uploadError } = await supabase.storage.from("audio").upload(storagePath, part.bytes, {
        contentType: mimeType,
        upsert: false,
      })
      if (uploadError) {
        throw new Error(storageUploadMessage(uploadError.message))
      }
      const position = index + 1
      const start = formatClock(part.startSeconds * 1000)
      const end = formatClock((part.startSeconds + part.durationSeconds) * 1000)
      const { error: insertError } = await supabase.from("audio_files").insert({
        id: audioId,
        owner_id: input.userId,
        project_id: input.projectId,
        title: partTitle(input.title, position, input.parts.length),
        description: `Parte ${position} de ${input.parts.length} de “${input.title}”, de ${start} a ${end}.`.slice(0, 4000),
        original_filename: sanitizeOriginalFilename(`${input.title}-parte-${position}.${input.format}`),
        storage_path: storagePath,
        mime_type: mimeType,
        format: input.format,
        size_bytes: part.bytes.byteLength,
        duration_seconds: part.durationSeconds,
        status: "queued",
        error_message: null,
        processing_authorized: true,
      })
      if (insertError) {
        await supabase.storage.from("audio").remove([storagePath])
        throw new Error("Não foi possível registrar uma parte do áudio.")
      }
      const { data: job, error: jobError } = await supabase
        .from("transcription_jobs")
        .insert({
          owner_id: input.userId,
          audio_file_id: audioId,
          status: "queued",
          provider: "local",
          idempotency_key: "primary",
        })
        .select("id")
        .single()
      if (jobError || !job) {
        await supabase.from("audio_files").delete().eq("id", audioId).eq("owner_id", input.userId)
        await supabase.storage.from("audio").remove([storagePath])
        throw new Error("Não foi possível criar a tarefa de uma parte.")
      }
      created.push({ audioId, storagePath, jobId: job.id })
    }
  } catch (caught) {
    for (const item of created) {
      await supabase.storage.from("audio").remove([item.storagePath])
      await supabase.from("audio_files").delete().eq("id", item.audioId).eq("owner_id", input.userId)
    }
    throw caught
  }
  for (const item of created) {
    scheduleTranscription(item.jobId)
  }
  return created.map((item) => item.jobId)
}

export async function splitAudio(
  _previous: AudioActionState,
  formData: FormData,
): Promise<AudioActionState> {
  const audioId = z.uuid().safeParse(formData.get("audioId"))
  const minutes = z.coerce.number().safeParse(formData.get("partMinutes"))
  if (!audioId.success || !minutes.success || !isSplitPartMinutes(minutes.data)) {
    return { error: "Escolha partes de 10, 15 ou 20 minutos." }
  }
  const user = await getCurrentUser()
  const supabase = await createClient()
  const { data: audio, error } = await supabase
    .from("audio_files")
    .select("id, title, project_id, storage_path, format, status, error_message, processing_authorized")
    .eq("id", audioId.data)
    .eq("owner_id", user.id)
    .maybeSingle()
  if (error || !audio || !audio.processing_authorized || !isAcceptedAudioExtension(audio.format)) {
    return { error: "O áudio não foi encontrado." }
  }
  if (audio.status === "completed" || audio.error_message === AUDIO_DIVIDED_MESSAGE) {
    return { error: "Este áudio não pode ser dividido agora." }
  }
  const { data: file, error: downloadError } = await supabase.storage.from("audio").download(audio.storage_path)
  if (downloadError || !file) {
    return { error: "Não foi possível ler o áudio no armazenamento." }
  }

  requestTranscriptionCancel(audio.id)
  let split: Awaited<ReturnType<typeof splitAudioBytes>>
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    split = await splitAudioBytes(bytes, audio.format, minutes.data * 60)
    await storeAudioParts(supabase, {
      userId: user.id,
      projectId: audio.project_id,
      title: audio.title,
      format: audio.format,
      parts: split.parts,
    })
  } catch (caught) {
    clearTranscriptionCancel(audio.id)
    return { error: caught instanceof Error ? caught.message : "Não foi possível dividir o áudio." }
  }
  await supabase
    .from("audio_files")
    .update({
      status: "error",
      error_message: AUDIO_DIVIDED_MESSAGE,
      duration_seconds: split.durationSeconds,
    })
    .eq("id", audio.id)
    .eq("owner_id", user.id)
  await supabase
    .from("transcription_jobs")
    .update({
      status: "error",
      error_message: AUDIO_DIVIDED_MESSAGE,
      finished_at: new Date().toISOString(),
    })
    .eq("audio_file_id", audio.id)
    .eq("owner_id", user.id)
    .in("status", ["queued", "preparing", "transcribing"])
  clearSliceCheckpoint(audio.id)
  clearTranscriptionProgress(audio.id)
  revalidateAudioPaths(audio.id)
  redirect("/transcricoes")
}
