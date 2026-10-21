import { Suspense } from "react"
import { z } from "zod"
import { AnalysisSettingsForm } from "@/components/analysis/settings-form"
import { AudioFilter } from "@/components/analysis/audio-filter"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatClock } from "@/domain/captions"
import { analyzeUtterances } from "@/domain/text-analysis"
import { getCurrentUser } from "@/server/auth/current-user"
import { listCompletedAudios, loadAnalysisSettings, loadUtterances } from "@/server/transcription/load"

async function AnalysesContent({ searchParams }: { searchParams: Promise<{ audio?: string }> }) {
  const user = await getCurrentUser()
  const params = await searchParams
  const requested = z.uuid().safeParse(params.audio).success ? params.audio ?? null : null
  const audios = await listCompletedAudios(user.id)
  const selectedId = requested && audios.some((audio) => audio.id === requested) ? requested : null
  const settings = await loadAnalysisSettings(user.id)
  const analysis = analyzeUtterances(await loadUtterances(user.id, selectedId), settings)
  const totalTalk = analysis.speakers.reduce((sum, speaker) => sum + speaker.talkMs, 0)

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Análises</h1>
        <p className="mt-3 max-w-2xl text-lg leading-8 text-muted-foreground">
          Tempo de fala, turnos e termos saem dos trechos salvos. A aplicação não atribui nome civil a uma voz.
        </p>
      </div>
      <AudioFilter action="/analises" audios={audios} selectedId={selectedId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium text-muted-foreground">Tempo de fala</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold tabular-nums">{formatClock(analysis.durationMs)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium text-muted-foreground">Palavras</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold tabular-nums">{analysis.wordCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium text-muted-foreground">Participantes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold tabular-nums">{analysis.speakers.length}</p>
          </CardContent>
        </Card>
      </div>
      {analysis.speakers.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-5 py-4 text-base text-muted-foreground">
          Nenhuma transcrição concluída neste recorte.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Por participante</CardTitle>
            <CardDescription>A soma dos trechos pode incluir sobreposição.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {analysis.speakers.map((speaker) => {
                const share = totalTalk > 0 ? Math.round((speaker.talkMs / totalTalk) * 100) : 0
                return (
                  <li key={speaker.name} className="flex flex-wrap items-baseline justify-between gap-3 text-base">
                    <span className="font-semibold">{speaker.name}</span>
                    <span className="text-muted-foreground">
                      {formatClock(speaker.talkMs)} · {share}% · {speaker.turns} turno{speaker.turns === 1 ? "" : "s"} ·{" "}
                      {speaker.words} palavras
                    </span>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}
      {analysis.terms.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Termos mais frequentes</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-2">
              {analysis.terms.slice(0, 15).map((term) => (
                <li key={term.term} className="flex justify-between gap-4 text-base">
                  <span>{term.term}</span>
                  <span className="tabular-nums text-muted-foreground">{term.count}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Valem para a nuvem, as análises e o SVG da nuvem.</CardDescription>
        </CardHeader>
        <CardContent>
          <AnalysisSettingsForm
            removePunctuation={settings.removePunctuation}
            useLemmatization={settings.useLemmatization}
            ignoredWords={settings.ignoredWords}
          />
        </CardContent>
      </Card>
    </section>
  )
}

export default function AnalysesPage({ searchParams }: { searchParams: Promise<{ audio?: string }> }) {
  return (
    <Suspense fallback={<p className="text-lg text-muted-foreground">Carregando análises…</p>}>
      <AnalysesContent searchParams={searchParams} />
    </Suspense>
  )
}
