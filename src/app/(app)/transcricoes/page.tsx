import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatBytes } from "@/domain/audio-file"
import { DeleteAudioButton, PauseTranscriptionButton, ReloadTranscriptionButton, ResumeTranscriptionButton } from "@/components/transcriptions/audio-actions"
import { ProgressMeter } from "@/components/transcriptions/progress-meter"
import { StatusBadge } from "@/components/transcriptions/status-badge"
import { StatusPoller } from "@/components/transcriptions/status-poller"
import { isPausedTranscription, canPauseProcessing } from "@/domain/audio-pause"
import { isActiveProcessing, isProcessingStatus } from "@/domain/processing-status"
import { getCurrentUser } from "@/server/auth/current-user"
import { listAudios } from "@/server/transcription/load"

async function TranscriptionsContent() {
  await connection()
  const user = await getCurrentUser()
  const { items, error } = await listAudios(user.id)
  const activeIds = items
    .filter((audio) => isProcessingStatus(audio.status) && isActiveProcessing(audio.status))
    .map((audio) => audio.id)

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8">
      <StatusPoller active={activeIds.length > 0} audioIds={activeIds} />
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Transcrições</h1>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-muted-foreground">
            Cada voz reconhecida vira um participante. Você pode renomear o rótulo depois.
          </p>
        </div>
        <Link href="/importar" className={buttonVariants()}>
          Importar áudio
        </Link>
      </header>
      {error ? (
        <p role="alert" className="rounded-lg bg-destructive px-4 py-3 text-base text-white">
          {error}
        </p>
      ) : null}
      {!error && items.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-5 py-4 text-base text-muted-foreground">
          Nenhum áudio importado.
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {items.map((audio) => {
          const status = isProcessingStatus(audio.status) ? audio.status : null
          return (
            <li key={audio.id}>
              <Card>
                <CardHeader>
                  <CardTitle>
                    <Link href={`/transcricoes/${audio.id}`} className="hover:underline">
                      {audio.title}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {audio.projectTitle ? `${audio.projectTitle} · ` : ""}
                    {formatBytes(audio.sizeBytes)} ·{" "}
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
                      new Date(audio.importedAt),
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <StatusBadge audioId={audio.id} status={audio.status} errorMessage={audio.errorMessage} />
                    <div className="flex flex-wrap gap-2">
                      {status && canPauseProcessing(status) ? <PauseTranscriptionButton audioId={audio.id} /> : null}
                      {isPausedTranscription(audio.status, audio.errorMessage) ? (
                        <ResumeTranscriptionButton audioId={audio.id} />
                      ) : null}
                      {status === "completed" ? <ReloadTranscriptionButton audioId={audio.id} /> : null}
                      <DeleteAudioButton audioId={audio.id} />
                    </div>
                  </div>
                  {status && isActiveProcessing(status) ? (
                    <ProgressMeter
                      compact
                      audioId={audio.id}
                      status={status}
                      reportedPercent={audio.progressPercent}
                      startedAt={audio.progressStartedAt}
                      durationSeconds={audio.durationSeconds}
                      jobStartedAt={audio.jobStartedAt}
                    />
                  ) : null}
                  {audio.errorMessage ? <p className="text-base leading-7">{audio.errorMessage}</p> : null}
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function TranscriptionsPage() {
  return (
    <Suspense fallback={<p className="text-lg text-muted-foreground">Carregando transcrições…</p>}>
      <TranscriptionsContent />
    </Suspense>
  )
}
