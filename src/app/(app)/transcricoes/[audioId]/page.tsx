import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { z } from "zod"
import { DeleteAudioButton, PauseTranscriptionButton, ReloadTranscriptionButton, ResumeTranscriptionButton, RetryTranscriptionButton } from "@/components/transcriptions/audio-actions"
import { SplitAudioForm } from "@/components/transcriptions/split-audio-form"
import { TranscriptDocument } from "@/components/transcriptions/transcript-document"
import { IdentifySpeakersButton } from "@/components/transcriptions/identify-speakers-button"
import { speakerColorClass } from "@/components/transcriptions/speaker-color"
import { SpeakerRenameForm } from "@/components/transcriptions/speaker-rename-form"
import { ProgressMeter } from "@/components/transcriptions/progress-meter"
import { StatusBadge } from "@/components/transcriptions/status-badge"
import { StatusPoller } from "@/components/transcriptions/status-poller"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatBytes } from "@/domain/audio-file"
import { formatClock } from "@/domain/captions"
import { groupTranscriptTurns } from "@/domain/transcript-export"
import { AUDIO_DIVIDED_MESSAGE, offersAudioSplit } from "@/domain/audio-split"
import { AUDIO_PAUSED_MESSAGE, canPauseProcessing, isPausedTranscription } from "@/domain/audio-pause"
import { isActiveProcessing } from "@/domain/processing-status"
import { getCurrentUser } from "@/server/auth/current-user"
import { loadAudioDetail } from "@/server/transcription/load"

async function DetailContent({ params }: { params: Promise<{ audioId: string }> }) {
  await connection()
  const { audioId } = await params
  if (!z.uuid().safeParse(audioId).success) {
    return <p className="text-lg text-muted-foreground">Áudio não encontrado.</p>
  }
  const user = await getCurrentUser()
  const audio = await loadAudioDetail(user.id, audioId)
  if (!audio || !audio.status) {
    return <p className="text-lg text-muted-foreground">Áudio não encontrado.</p>
  }

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8">
      <StatusPoller active={isActiveProcessing(audio.status)} audioIds={[audio.id]} />
      <div className="flex flex-col gap-4">
        <Link href="/transcricoes" className={`${buttonVariants({ variant: "outline" })} self-start`}>
          Voltar
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{audio.title}</h1>
          <p className="mt-3 text-lg leading-8 text-muted-foreground">
            {formatBytes(audio.sizeBytes)} · {audio.format.toUpperCase()}
            {audio.durationSeconds != null ? ` · ${formatClock(audio.durationSeconds * 1000)}` : ""}
          </p>
        </div>
        <StatusBadge audioId={audio.id} status={audio.status} errorMessage={audio.errorMessage} />
        {audio.description ? <p className="text-base leading-7">{audio.description}</p> : null}
        {audio.errorMessage &&
        audio.errorMessage !== AUDIO_DIVIDED_MESSAGE &&
        audio.errorMessage !== AUDIO_PAUSED_MESSAGE ? (
          <p role="alert" className="rounded-lg bg-destructive px-4 py-3 text-base text-white">
            {audio.errorMessage}
          </p>
        ) : null}
        {audio.errorMessage === AUDIO_DIVIDED_MESSAGE || audio.errorMessage === AUDIO_PAUSED_MESSAGE ? (
          <p className="text-base leading-7">{audio.errorMessage}</p>
        ) : null}
        {audio.transcription?.splitNote ? (
          <p className="text-base leading-7">{audio.transcription.splitNote}</p>
        ) : null}
      </div>
      {audio.signedUrl ? <audio controls preload="none" src={audio.signedUrl} className="w-full" /> : null}
      <div className="flex flex-wrap gap-3">
        {audio.status && canPauseProcessing(audio.status) ? <PauseTranscriptionButton audioId={audio.id} /> : null}
        {isPausedTranscription(audio.status, audio.errorMessage) ? (
          <ResumeTranscriptionButton audioId={audio.id} />
        ) : null}
        {audio.canRetry && audio.errorMessage !== AUDIO_DIVIDED_MESSAGE && !isPausedTranscription(audio.status, audio.errorMessage) ? (
          <RetryTranscriptionButton audioId={audio.id} />
        ) : null}
        {audio.status === "completed" ? <ReloadTranscriptionButton audioId={audio.id} /> : null}
        <DeleteAudioButton audioId={audio.id} />
        {audio.status === "completed" ? (
          <Link href={`/relatorios?audio=${audio.id}`} className={buttonVariants({ variant: "outline" })}>
            Exportar
          </Link>
        ) : null}
      </div>
      {offersAudioSplit(audio.status, audio.durationSeconds, audio.sizeBytes, audio.errorMessage) ? (
        <Card>
          <CardHeader>
            <CardTitle>Dividir áudio</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-base leading-7 text-muted-foreground">
              Para um áudio longo, cada parte vira uma transcrição própria. Elas entram na fila uma depois da outra.
            </p>
            <SplitAudioForm audioId={audio.id} />
          </CardContent>
        </Card>
      ) : null}
      {audio.speakers.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Participantes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-base leading-7 text-muted-foreground">
              O nome escrito aqui é o mesmo que aparece na transcrição.
            </p>
            {audio.status === "completed" ? <IdentifySpeakersButton audioId={audio.id} /> : null}
            {audio.speakers.map((speaker) => (
              <div key={speaker.id} className="flex flex-col gap-2">
                <span className={`w-fit rounded-md px-2 py-1 text-sm font-semibold ${speakerColorClass(speaker.colorToken)}`}>
                  {speaker.displayName}
                </span>
                <SpeakerRenameForm speakerId={speaker.id} displayName={speaker.displayName} />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      {audio.segments.length > 0 && audio.transcription ? (
        <TranscriptDocument
          transcriptionId={audio.transcription.id}
          turns={groupTranscriptTurns(
            audio.segments.map((segment) => ({
              id: segment.id,
              speakerName: segment.speakerName,
              colorToken: segment.colorToken,
              text: segment.text,
            })),
          )}
        />
      ) : null}
      {isActiveProcessing(audio.status) ? (
        <ProgressMeter
          audioId={audio.id}
          status={audio.status}
          reportedPercent={audio.progressPercent}
          startedAt={audio.progressStartedAt}
          durationSeconds={audio.durationSeconds}
          jobStartedAt={audio.jobStartedAt}
        />
      ) : null}
    </section>
  )
}

export default function TranscriptionDetailPage({ params }: { params: Promise<{ audioId: string }> }) {
  return (
    <Suspense fallback={<p className="text-lg text-muted-foreground">Carregando transcrição…</p>}>
      <DetailContent params={params} />
    </Suspense>
  )
}
