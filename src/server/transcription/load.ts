import "server-only"

import type { LiveAudio } from "@/domain/live-audio"
import {
  ACTIVE_PROCESSING_STATUSES,
  isActiveProcessing,
  isProcessingStatus,
  type ProcessingStatus,
} from "@/domain/processing-status"
import type { AnalysisSettingsInput, TranscriptUtterance } from "@/domain/text-analysis"
import type { ExportDocument } from "@/domain/transcript-export"
import { createClient } from "@/lib/supabase/server"
import { readTranscriptionProgress } from "@/server/transcription/progress-store"

export type AudioListItem = {
  id: string
  title: string
  status: string
  errorMessage: string | null
  importedAt: string
  sizeBytes: number
  projectTitle: string | null
  progressPercent: number | null
  progressStartedAt: number | null
  durationSeconds: number | null
  jobStartedAt: number | null
}

export type TranscriptSegmentView = {
  id: string
  speakerName: string
  colorToken: string
  startMs: number
  endMs: number
  text: string
}

export type AudioDetail = {
  id: string
  title: string
  description: string
  status: ProcessingStatus | null
  errorMessage: string | null
  format: string
  sizeBytes: number
  durationSeconds: number | null
  signedUrl: string | null
  canRetry: boolean
  progressPercent: number | null
  progressStartedAt: number | null
  jobStartedAt: number | null
  transcription: {
    id: string
    language: string
    model: string
    audioWasSplit: boolean
    splitNote: string | null
  } | null
  speakers: { id: string; displayName: string; colorToken: string }[]
  segments: TranscriptSegmentView[]
}

export type CompletedAudio = { id: string; title: string }

const DEFAULT_SETTINGS: AnalysisSettingsInput = {
  removePunctuation: true,
  useLemmatization: false,
  ignoredWords: [],
}

export async function listAudios(userId: string): Promise<{ items: AudioListItem[]; error: string | null }> {
  const supabase = await createClient()
  const [{ data: audios, error: audioError }, { data: projects }, { data: jobs }] = await Promise.all([
    supabase
      .from("audio_files")
      .select("id, title, status, error_message, imported_at, size_bytes, duration_seconds, project_id")
      .eq("owner_id", userId)
      .order("imported_at", { ascending: false }),
    supabase.from("projects").select("id, title").eq("owner_id", userId),
    supabase
      .from("transcription_jobs")
      .select("audio_file_id, started_at")
      .eq("owner_id", userId)
      .order("started_at", { ascending: false }),
  ])
  if (audioError) {
    return { items: [], error: "Não foi possível listar os áudios." }
  }
  const projectTitles = new Map((projects ?? []).map((project) => [project.id, project.title]))
  const jobStartedAt = new Map<string, number>()
  for (const job of jobs ?? []) {
    if (!job.started_at || jobStartedAt.has(job.audio_file_id)) {
      continue
    }
    jobStartedAt.set(job.audio_file_id, new Date(job.started_at).getTime())
  }
  return {
    error: null,
    items: (audios ?? []).map((audio) => {
      const progress =
        isProcessingStatus(audio.status) && isActiveProcessing(audio.status)
          ? readTranscriptionProgress(audio.id)
          : null
      return {
        id: audio.id,
        title: audio.title,
        status: audio.status,
        errorMessage: audio.error_message,
        importedAt: audio.imported_at,
        sizeBytes: audio.size_bytes,
        projectTitle: audio.project_id ? projectTitles.get(audio.project_id) ?? null : null,
        progressPercent: progress?.percent ?? null,
        progressStartedAt: progress?.startedAt ?? null,
        durationSeconds: audio.duration_seconds == null ? null : Number(audio.duration_seconds),
        jobStartedAt: jobStartedAt.get(audio.id) ?? null,
      }
    }),
  }
}

export async function loadAudioDetail(userId: string, audioId: string): Promise<AudioDetail | null> {
  const supabase = await createClient()
  const { data: audio, error } = await supabase
    .from("audio_files")
    .select("id, title, description, status, error_message, format, size_bytes, duration_seconds, storage_path")
    .eq("id", audioId)
    .eq("owner_id", userId)
    .maybeSingle()
  if (error || !audio || !isProcessingStatus(audio.status)) {
    return null
  }

  const { data: signed } = await supabase.storage.from("audio").createSignedUrl(audio.storage_path, 60 * 30)
  const { data: transcription } = await supabase
    .from("transcriptions")
    .select("id, language, model, audio_was_split, split_limitation_note")
    .eq("audio_file_id", audio.id)
    .eq("owner_id", userId)
    .maybeSingle()
  const { data: job } = await supabase
    .from("transcription_jobs")
    .select("id, started_at")
    .eq("audio_file_id", audio.id)
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle()

  let speakers: AudioDetail["speakers"] = []
  let segments: TranscriptSegmentView[] = []
  if (transcription && audio.status === "completed") {
    const [{ data: speakerRows }, { data: segmentRows }] = await Promise.all([
      supabase
        .from("speakers")
        .select("id, display_name, color_token, sort_order")
        .eq("transcription_id", transcription.id)
        .eq("owner_id", userId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("transcription_segments")
        .select("id, speaker_id, start_ms, end_ms, text, segment_index")
        .eq("transcription_id", transcription.id)
        .eq("owner_id", userId)
        .order("segment_index", { ascending: true }),
    ])
    speakers = (speakerRows ?? []).map((speaker) => ({
      id: speaker.id,
      displayName: speaker.display_name,
      colorToken: speaker.color_token,
    }))
    const speakerById = new Map(speakers.map((speaker) => [speaker.id, speaker]))
    segments = (segmentRows ?? []).map((segment) => {
      const speaker = segment.speaker_id ? speakerById.get(segment.speaker_id) : undefined
      return {
        id: segment.id,
        speakerName: speaker?.displayName ?? "Participante",
        colorToken: speaker?.colorToken ?? "slate",
        startMs: segment.start_ms,
        endMs: segment.end_ms,
        text: segment.text,
      }
    })
  }

  const progress = isActiveProcessing(audio.status) ? readTranscriptionProgress(audio.id) : null
  return {
    id: audio.id,
    title: audio.title,
    description: audio.description,
    status: audio.status,
    errorMessage: audio.error_message,
    format: audio.format,
    sizeBytes: audio.size_bytes,
    durationSeconds: audio.duration_seconds == null ? null : Number(audio.duration_seconds),
    signedUrl: signed?.signedUrl ?? null,
    canRetry: audio.status === "error" && Boolean(job),
    progressPercent: progress?.percent ?? null,
    progressStartedAt: progress?.startedAt ?? null,
    jobStartedAt: job?.started_at ? new Date(job.started_at).getTime() : null,
    transcription: transcription
      ? {
          id: transcription.id,
          language: transcription.language,
          model: transcription.model,
          audioWasSplit: transcription.audio_was_split,
          splitNote: transcription.split_limitation_note,
        }
      : null,
    speakers,
    segments,
  }
}

export async function listActiveAudios(userId: string): Promise<{ items: LiveAudio[]; error: string | null }> {
  const supabase = await createClient()
  const { data: audios, error } = await supabase
    .from("audio_files")
    .select("id, status, duration_seconds")
    .eq("owner_id", userId)
    .in("status", ACTIVE_PROCESSING_STATUSES)
  if (error) {
    return { items: [], error: "Não foi possível consultar o andamento." }
  }
  if (!audios || audios.length === 0) {
    return { items: [], error: null }
  }

  const { data: jobs, error: jobError } = await supabase
    .from("transcription_jobs")
    .select("audio_file_id, started_at")
    .eq("owner_id", userId)
    .in(
      "audio_file_id",
      audios.map((audio) => audio.id),
    )
    .order("started_at", { ascending: false })
  if (jobError) {
    return { items: [], error: "Não foi possível consultar o andamento." }
  }

  const jobStartedAt = new Map<string, number>()
  for (const job of jobs ?? []) {
    if (!job.started_at || jobStartedAt.has(job.audio_file_id)) {
      continue
    }
    jobStartedAt.set(job.audio_file_id, new Date(job.started_at).getTime())
  }

  const items: LiveAudio[] = []
  for (const audio of audios) {
    if (!isProcessingStatus(audio.status) || !isActiveProcessing(audio.status)) {
      continue
    }
    const progress = readTranscriptionProgress(audio.id)
    items.push({
      id: audio.id,
      status: audio.status,
      progressPercent: progress?.percent ?? null,
      progressStartedAt: progress?.startedAt ?? null,
      durationSeconds: audio.duration_seconds == null ? null : Number(audio.duration_seconds),
      jobStartedAt: jobStartedAt.get(audio.id) ?? null,
    })
  }
  return { items, error: null }
}

export async function listCompletedAudios(userId: string): Promise<CompletedAudio[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("audio_files")
    .select("id, title")
    .eq("owner_id", userId)
    .eq("status", "completed")
    .order("imported_at", { ascending: false })
  return data ?? []
}

export async function loadAnalysisSettings(userId: string): Promise<AnalysisSettingsInput & { saved: boolean }> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("analysis_settings")
    .select("use_lemmatization, remove_punctuation, custom_ignored_words")
    .eq("owner_id", userId)
    .is("project_id", null)
    .is("audio_file_id", null)
    .maybeSingle()
  if (!data) {
    return { ...DEFAULT_SETTINGS, saved: false }
  }
  return {
    removePunctuation: data.remove_punctuation,
    useLemmatization: data.use_lemmatization,
    ignoredWords: data.custom_ignored_words,
    saved: true,
  }
}

export async function loadUtterances(userId: string, audioId: string | null): Promise<TranscriptUtterance[]> {
  const supabase = await createClient()
  const audioQuery = supabase.from("audio_files").select("id").eq("owner_id", userId).eq("status", "completed")
  const { data: audios } = await (audioId ? audioQuery.eq("id", audioId) : audioQuery)
  const audioIds = (audios ?? []).map((audio) => audio.id)
  if (audioIds.length === 0) {
    return []
  }
  const { data: transcriptions } = await supabase
    .from("transcriptions")
    .select("id, audio_file_id")
    .eq("owner_id", userId)
    .in("audio_file_id", audioIds)
  const transcriptionIds = (transcriptions ?? []).map((transcription) => transcription.id)
  if (transcriptionIds.length === 0) {
    return []
  }
  const [{ data: segments }, { data: speakers }] = await Promise.all([
    supabase
      .from("transcription_segments")
      .select("transcription_id, speaker_id, start_ms, end_ms, text, segment_index")
      .eq("owner_id", userId)
      .in("transcription_id", transcriptionIds)
      .order("segment_index", { ascending: true }),
    supabase
      .from("speakers")
      .select("id, display_name")
      .eq("owner_id", userId)
      .in("transcription_id", transcriptionIds),
  ])
  const names = new Map((speakers ?? []).map((speaker) => [speaker.id, speaker.display_name]))
  return (segments ?? []).map((segment) => ({
    speakerName: names.get(segment.speaker_id ?? "") ?? "Participante",
    startMs: segment.start_ms,
    endMs: segment.end_ms,
    text: segment.text,
  }))
}

export async function loadExportDocument(userId: string, audioId: string): Promise<ExportDocument | null> {
  const detail = await loadAudioDetail(userId, audioId)
  if (!detail || detail.status !== "completed" || detail.segments.length === 0) {
    return null
  }
  return {
    title: detail.title,
    language: detail.transcription?.language ?? "pt",
    segments: detail.segments.map((segment) => ({
      speakerName: segment.speakerName,
      startMs: segment.startMs,
      endMs: segment.endMs,
      text: segment.text,
    })),
  }
}
