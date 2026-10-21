"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { speakerDraftsFromLabels } from "@/domain/diarized-transcript"
import { assignSpeakerLabels } from "@/domain/speaker-diarization"
import { groupTranscriptTurns } from "@/domain/transcript-export"
import { getCurrentUser } from "@/server/auth/current-user"
import { createClient } from "@/lib/supabase/server"
import { decodeAudioToMonoPcm } from "@/server/transcription/decode-audio"

export type TranscriptActionState = { error: string | null }

async function rebuildRevisedText(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  transcriptionId: string,
) {
  const [{ data: segments }, { data: speakers }] = await Promise.all([
    supabase
      .from("transcription_segments")
      .select("segment_index, text, speaker_id")
      .eq("transcription_id", transcriptionId)
      .eq("owner_id", userId)
      .order("segment_index", { ascending: true }),
    supabase
      .from("speakers")
      .select("id, display_name")
      .eq("transcription_id", transcriptionId)
      .eq("owner_id", userId),
  ])
  const names = new Map((speakers ?? []).map((speaker) => [speaker.id, speaker.display_name]))
  const revised = (segments ?? [])
    .map((segment) => `${names.get(segment.speaker_id ?? "") ?? "Participante"}: ${segment.text.trim()}`)
    .join("\n\n")
  await supabase
    .from("transcriptions")
    .update({ revised_full_text: revised })
    .eq("id", transcriptionId)
    .eq("owner_id", userId)
}

export async function updateTranscriptDocument(
  _previous: TranscriptActionState,
  formData: FormData,
): Promise<TranscriptActionState> {
  const turnIds = formData.getAll("turnId").map(String)
  const turnTexts = formData.getAll("turnText").map(String)
  const turnExtras = formData.getAll("turnExtra").map(String)
  const parsed = z
    .object({
      transcriptionId: z.uuid(),
      turnIds: z.array(z.uuid()).min(1),
      turnTexts: z.array(z.string().trim().min(1).max(200_000)),
      extraIds: z.array(z.uuid()),
    })
    .refine((value) => value.turnIds.length === value.turnTexts.length, {
      path: ["turnTexts"],
    })
    .safeParse({
      transcriptionId: formData.get("transcriptionId"),
      turnIds,
      turnTexts,
      extraIds: turnExtras.flatMap((value) => value.split(",").filter((id) => id.length > 0)),
    })
  if (!parsed.success) {
    return { error: "Cada participante precisa ter texto, com até 200.000 caracteres." }
  }

  const user = await getCurrentUser()
  const supabase = await createClient()
  const [{ data: segments, error: segmentError }, { data: speakers, error: speakerError }] = await Promise.all([
    supabase
      .from("transcription_segments")
      .select("id, text, speaker_id")
      .eq("transcription_id", parsed.data.transcriptionId)
      .eq("owner_id", user.id)
      .order("segment_index", { ascending: true }),
    supabase
      .from("speakers")
      .select("id, display_name")
      .eq("transcription_id", parsed.data.transcriptionId)
      .eq("owner_id", user.id),
  ])
  if (segmentError || speakerError || !segments || segments.length === 0) {
    return { error: "A transcrição não foi encontrada." }
  }

  const names = new Map((speakers ?? []).map((speaker) => [speaker.id, speaker.display_name]))
  const current = groupTranscriptTurns(
    segments.map((segment) => ({
      id: segment.id,
      speakerName: names.get(segment.speaker_id ?? "") ?? "Participante",
      colorToken: "slate",
      text: segment.text,
    })),
  )
  const sameShape =
    current.length === parsed.data.turnIds.length &&
    current.every((turn, index) => turn.id === parsed.data.turnIds[index])
  const knownIds = new Set(segments.map((segment) => segment.id))
  const extrasKnown = parsed.data.extraIds.every((id) => knownIds.has(id) && !parsed.data.turnIds.includes(id))
  if (!sameShape || !extrasKnown) {
    return { error: "A transcrição mudou. Atualize a página e tente de novo." }
  }

  const textChanged = current.some((turn, index) => turn.text !== parsed.data.turnTexts[index])
  if (!textChanged && parsed.data.extraIds.length === 0) {
    return { error: null }
  }

  if (textChanged) {
    for (let index = 0; index < parsed.data.turnIds.length; index += 1) {
      const id = parsed.data.turnIds[index]
      const text = parsed.data.turnTexts[index]
      if (!id || text == null || current[index]?.text === text) {
        continue
      }
      const { error: updateError } = await supabase
        .from("transcription_segments")
        .update({ text })
        .eq("id", id)
        .eq("owner_id", user.id)
      if (updateError) {
        return { error: "Não foi possível salvar o texto." }
      }
    }
  }

  if (parsed.data.extraIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("transcription_segments")
      .delete()
      .in("id", parsed.data.extraIds)
      .eq("transcription_id", parsed.data.transcriptionId)
      .eq("owner_id", user.id)
    if (deleteError) {
      return { error: "O texto mudou, mas os trechos antigos não foram unidos." }
    }
  }

  const revised = current
    .map((turn, index) => `${turn.speakerName}\n${parsed.data.turnTexts[index] ?? turn.text}`)
    .join("\n\n")
  if (textChanged) {
    const previous = current.map((turn) => `${turn.speakerName}\n${turn.text}`).join("\n\n")
    const { error: revisionError } = await supabase.from("transcription_revisions").insert({
      owner_id: user.id,
      transcription_id: parsed.data.transcriptionId,
      segment_id: parsed.data.turnIds[0] ?? null,
      revision_kind: parsed.data.extraIds.length > 0 ? "segment_merge" : "text_edit",
      previous_value: { text: previous },
      new_value: { text: revised },
    })
    if (revisionError) {
      return { error: "O texto mudou, mas o histórico da revisão não foi gravado." }
    }
  }

  const { data: transcription } = await supabase
    .from("transcriptions")
    .update({ revised_full_text: revised })
    .eq("id", parsed.data.transcriptionId)
    .eq("owner_id", user.id)
    .select("audio_file_id")
    .maybeSingle()
  revalidatePath("/transcricoes")
  if (transcription) {
    revalidatePath(`/transcricoes/${transcription.audio_file_id}`)
  }
  revalidatePath("/nuvem")
  revalidatePath("/analises")
  revalidatePath("/relatorios")
  return { error: null }
}

export async function updateSegmentText(
  _previous: TranscriptActionState,
  formData: FormData,
): Promise<TranscriptActionState> {
  const parsed = z
    .object({
      segmentId: z.uuid(),
      text: z.string().trim().min(1).max(8000),
    })
    .safeParse({
      segmentId: formData.get("segmentId"),
      text: formData.get("text"),
    })
  if (!parsed.success) {
    return { error: "O trecho precisa ter texto, com até 8000 caracteres." }
  }

  const user = await getCurrentUser()
  const supabase = await createClient()
  const { data: segment, error: segmentError } = await supabase
    .from("transcription_segments")
    .select("id, text, transcription_id")
    .eq("id", parsed.data.segmentId)
    .eq("owner_id", user.id)
    .maybeSingle()
  if (segmentError || !segment) {
    return { error: "O trecho não foi encontrado." }
  }
  if (segment.text === parsed.data.text) {
    return { error: null }
  }

  const { error: updateError } = await supabase
    .from("transcription_segments")
    .update({ text: parsed.data.text })
    .eq("id", segment.id)
    .eq("owner_id", user.id)
  if (updateError) {
    return { error: "Não foi possível salvar o trecho." }
  }
  const { error: revisionError } = await supabase.from("transcription_revisions").insert({
    owner_id: user.id,
    transcription_id: segment.transcription_id,
    segment_id: segment.id,
    revision_kind: "text_edit",
    previous_value: { text: segment.text },
    new_value: { text: parsed.data.text },
  })
  if (revisionError) {
    return { error: "O trecho mudou, mas o histórico da revisão não foi gravado." }
  }
  await rebuildRevisedText(supabase, user.id, segment.transcription_id)
  revalidatePath("/transcricoes")
  revalidatePath("/nuvem")
  revalidatePath("/analises")
  revalidatePath("/relatorios")
  return { error: null }
}

export async function renameSpeaker(
  _previous: TranscriptActionState,
  formData: FormData,
): Promise<TranscriptActionState> {
  const parsed = z
    .object({
      speakerId: z.uuid(),
      displayName: z.string().trim().min(1).max(120),
    })
    .safeParse({
      speakerId: formData.get("speakerId"),
      displayName: formData.get("displayName"),
    })
  if (!parsed.success) {
    return { error: "O nome do participante precisa ter de 1 a 120 caracteres." }
  }

  const user = await getCurrentUser()
  const supabase = await createClient()
  const { data: speaker, error: speakerError } = await supabase
    .from("speakers")
    .select("id, display_name, transcription_id")
    .eq("id", parsed.data.speakerId)
    .eq("owner_id", user.id)
    .maybeSingle()
  if (speakerError || !speaker) {
    return { error: "O participante não foi encontrado." }
  }
  if (speaker.display_name === parsed.data.displayName) {
    return { error: null }
  }

  const { error: updateError } = await supabase
    .from("speakers")
    .update({ display_name: parsed.data.displayName })
    .eq("id", speaker.id)
    .eq("owner_id", user.id)
  if (updateError) {
    return { error: "Não foi possível renomear o participante." }
  }
  await supabase.from("transcription_revisions").insert({
    owner_id: user.id,
    transcription_id: speaker.transcription_id,
    speaker_id: speaker.id,
    revision_kind: "speaker_rename",
    previous_value: { display_name: speaker.display_name },
    new_value: { display_name: parsed.data.displayName },
  })
  await rebuildRevisedText(supabase, user.id, speaker.transcription_id)
  const { data: transcription } = await supabase
    .from("transcriptions")
    .select("audio_file_id")
    .eq("id", speaker.transcription_id)
    .eq("owner_id", user.id)
    .maybeSingle()
  revalidatePath("/transcricoes")
  if (transcription) {
    revalidatePath(`/transcricoes/${transcription.audio_file_id}`)
  }
  revalidatePath("/nuvem")
  revalidatePath("/analises")
  revalidatePath("/relatorios")
  return { error: null }
}

export async function identifySpeakers(
  _previous: TranscriptActionState,
  formData: FormData,
): Promise<TranscriptActionState> {
  const audioId = z.uuid().safeParse(formData.get("audioId"))
  if (!audioId.success) {
    return { error: "Áudio inválido." }
  }
  const user = await getCurrentUser()
  const supabase = await createClient()
  const { data: audio, error: audioError } = await supabase
    .from("audio_files")
    .select("id, status, storage_path")
    .eq("id", audioId.data)
    .eq("owner_id", user.id)
    .maybeSingle()
  if (audioError || !audio) {
    return { error: "Áudio não encontrado." }
  }
  if (audio.status !== "completed") {
    return { error: "A identificação das vozes fica disponível quando a transcrição termina." }
  }
  const { data: transcription, error: transcriptionError } = await supabase
    .from("transcriptions")
    .select("id")
    .eq("audio_file_id", audio.id)
    .eq("owner_id", user.id)
    .maybeSingle()
  if (transcriptionError || !transcription) {
    return { error: "A transcrição não foi encontrada." }
  }
  const { data: segments, error: segmentError } = await supabase
    .from("transcription_segments")
    .select("id, start_ms, end_ms")
    .eq("transcription_id", transcription.id)
    .eq("owner_id", user.id)
    .order("segment_index", { ascending: true })
  if (segmentError || !segments || segments.length === 0) {
    return { error: "Não há falas para separar." }
  }
  const downloaded = await supabase.storage.from("audio").download(audio.storage_path)
  if (downloaded.error || !downloaded.data) {
    return { error: "Não foi possível ler o áudio." }
  }
  const pcm = await decodeAudioToMonoPcm(new Uint8Array(await downloaded.data.arrayBuffer()))
  const labeled = assignSpeakerLabels(
    pcm,
    16_000,
    segments.map((segment) => ({
      id: segment.id,
      startSeconds: segment.start_ms / 1000,
      endSeconds: segment.end_ms / 1000,
    })),
  )
  const labels = labeled.map((segment) => segment.speakerLabel)
  if (new Set(labels).size < 2) {
    return { error: "Só uma voz ficou distinguível neste áudio." }
  }

  const { error: deleteError } = await supabase
    .from("speakers")
    .delete()
    .eq("transcription_id", transcription.id)
    .eq("owner_id", user.id)
  if (deleteError) {
    return { error: "Não foi possível separar os participantes." }
  }
  const drafts = speakerDraftsFromLabels(labels)
  const { data: speakers, error: speakerError } = await supabase
    .from("speakers")
    .insert(
      drafts.map((draft) => ({
        owner_id: user.id,
        transcription_id: transcription.id,
        provider_label: draft.providerLabel,
        chunk_index: draft.chunkIndex,
        display_name: draft.displayName,
        color_token: draft.colorToken,
        sort_order: draft.sortOrder,
      })),
    )
    .select("id, provider_label")
  if (speakerError || !speakers) {
    return { error: "Não foi possível gravar os participantes." }
  }
  const speakerIds = new Map(speakers.map((speaker) => [speaker.provider_label, speaker.id]))
  for (const segment of labeled) {
    const speakerId = speakerIds.get(segment.speakerLabel) ?? null
    const { error: updateError } = await supabase
      .from("transcription_segments")
      .update({ speaker_id: speakerId })
      .eq("id", segment.id)
      .eq("owner_id", user.id)
    if (updateError) {
      return { error: "As vozes foram encontradas, mas o documento não foi atualizado." }
    }
  }
  await supabase.from("transcription_revisions").insert({
    owner_id: user.id,
    transcription_id: transcription.id,
    revision_kind: "speaker_reassign",
    previous_value: { participantes: 1 },
    new_value: { participantes: drafts.length },
  })
  await rebuildRevisedText(supabase, user.id, transcription.id)
  revalidatePath("/transcricoes")
  revalidatePath(`/transcricoes/${audio.id}`)
  revalidatePath("/nuvem")
  revalidatePath("/analises")
  revalidatePath("/relatorios")
  return { error: null }
}
