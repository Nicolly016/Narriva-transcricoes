import { Suspense } from "react"
import { z } from "zod"
import { AudioFilter } from "@/components/analysis/audio-filter"
import { DownloadPngButton } from "@/components/reports/download-png-button"
import { buttonVariants } from "@/components/ui/button"
import { analyzeUtterances } from "@/domain/text-analysis"
import { getCurrentUser } from "@/server/auth/current-user"
import { listCompletedAudios, loadAnalysisSettings, loadUtterances } from "@/server/transcription/load"

const FORMATS = [
  ["txt", "TXT"],
  ["docx", "DOCX"],
  ["pdf", "PDF"],
  ["json", "JSON"],
  ["csv", "CSV"],
  ["srt", "SRT"],
  ["vtt", "VTT"],
  ["svg", "SVG"],
] as const

async function ReportsContent({ searchParams }: { searchParams: Promise<{ audio?: string }> }) {
  const user = await getCurrentUser()
  const params = await searchParams
  const requested = z.uuid().safeParse(params.audio).success ? params.audio ?? null : null
  const audios = await listCompletedAudios(user.id)
  const selectedId = requested && audios.some((audio) => audio.id === requested) ? requested : audios[0]?.id ?? null
  const settings = await loadAnalysisSettings(user.id)
  const terms = selectedId
    ? analyzeUtterances(await loadUtterances(user.id, selectedId), settings).terms
    : []

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Relatórios</h1>
        <p className="mt-3 max-w-2xl text-lg leading-8 text-muted-foreground">
          A exportação usa o texto atual dos trechos, inclusive os nomes que você deu aos participantes.
        </p>
      </div>
      {audios.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-5 py-4 text-base text-muted-foreground">
          Nenhuma transcrição concluída para exportar.
        </p>
      ) : (
        <>
          <AudioFilter action="/relatorios" audios={audios} selectedId={selectedId} allowAll={false} />
          <div className="flex flex-wrap gap-3">
            {FORMATS.map(([format, label]) => (
              <a
                key={format}
                href={`/relatorios/baixar?audio=${selectedId}&formato=${format}`}
                className={buttonVariants({ variant: "outline" })}
              >
                Baixar {label}
              </a>
            ))}
            <DownloadPngButton terms={terms.slice(0, 70)} />
          </div>
        </>
      )}
    </section>
  )
}

export default function ReportsPage({ searchParams }: { searchParams: Promise<{ audio?: string }> }) {
  return (
    <Suspense fallback={<p className="text-lg text-muted-foreground">Carregando relatórios…</p>}>
      <ReportsContent searchParams={searchParams} />
    </Suspense>
  )
}
