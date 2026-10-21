import Link from "next/link"
import { Suspense } from "react"
import { z } from "zod"
import { AudioFilter } from "@/components/analysis/audio-filter"
import { buttonVariants } from "@/components/ui/button"
import { cloudFontSize } from "@/domain/word-cloud"
import { analyzeUtterances } from "@/domain/text-analysis"
import { getCurrentUser } from "@/server/auth/current-user"
import { listCompletedAudios, loadAnalysisSettings, loadUtterances } from "@/server/transcription/load"

async function WordCloudContent({ searchParams }: { searchParams: Promise<{ audio?: string }> }) {
  const user = await getCurrentUser()
  const params = await searchParams
  const requested = z.uuid().safeParse(params.audio).success ? params.audio ?? null : null
  const audios = await listCompletedAudios(user.id)
  const selectedId = requested && audios.some((audio) => audio.id === requested) ? requested : null
  const settings = await loadAnalysisSettings(user.id)
  const analysis = analyzeUtterances(await loadUtterances(user.id, selectedId), settings)
  const terms = analysis.terms.slice(0, 70)
  const counts = terms.map((term) => term.count)
  const minCount = counts.length > 0 ? Math.min(...counts) : 0
  const maxCount = counts.length > 0 ? Math.max(...counts) : 0

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Nuvem de palavras</h1>
        <p className="mt-3 max-w-2xl text-lg leading-8 text-muted-foreground">
          A contagem usa o texto atual dos trechos, sem as palavras muito comuns do português. Os filtros ficam em Análises.
        </p>
      </div>
      <AudioFilter action="/nuvem" audios={audios} selectedId={selectedId} />
      {terms.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-5 py-4 text-base text-muted-foreground">
          Ainda não há termos para desenhar. Importe um áudio e espere a transcrição concluir.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-xl border border-border bg-card p-6">
          {terms.map((term) => (
            <span
              key={term.term}
              className="font-semibold text-primary"
              style={{ fontSize: cloudFontSize(term.count, minCount, maxCount) }}
              title={`${term.count} ocorrência${term.count === 1 ? "" : "s"}`}
            >
              {term.term}
            </span>
          ))}
        </div>
      )}
      <Link href="/analises" className={`${buttonVariants({ variant: "outline" })} self-start`}>
        Ajustar filtros
      </Link>
    </section>
  )
}

export default function WordCloudPage({ searchParams }: { searchParams: Promise<{ audio?: string }> }) {
  return (
    <Suspense fallback={<p className="text-lg text-muted-foreground">Carregando nuvem…</p>}>
      <WordCloudContent searchParams={searchParams} />
    </Suspense>
  )
}
