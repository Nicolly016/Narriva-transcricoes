import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/server/auth/current-user"
import { createClient } from "@/lib/supabase/server"

const COUNT_ACCENTS = ["border-t-chart-1", "border-t-chart-2", "border-t-chart-3"]

type CountResult = { label: string; value: number | null; error: string | null }

async function loadCount(
  table: "projects" | "audio_files" | "transcriptions",
  ownerId: string,
  label: string,
): Promise<CountResult> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)

  return {
    label,
    value: error ? null : count ?? 0,
    error: error ? "A consulta falhou. Aplique a migração do banco antes de usar os indicadores." : null,
  }
}

async function DashboardContent() {
  await connection()
  const user = await getCurrentUser()
  const counts = await Promise.all([
    loadCount("projects", user.id, "Projetos"),
    loadCount("audio_files", user.id, "Áudios"),
    loadCount("transcriptions", user.id, "Transcrições"),
  ])
  const databaseError = counts.find((count) => count.error)?.error ?? null

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Painel inicial</h1>
          <p className="mt-3 text-lg leading-8 text-muted-foreground">
            {user.email ? user.email : "Sessão autenticada."} Os números abaixo vêm do banco desta conta.
          </p>
        </div>
        <Link href="/projetos" className={buttonVariants()}>
          Abrir meus projetos
        </Link>
      </header>
      {databaseError ? (
        <p role="alert" className="rounded-lg bg-destructive px-4 py-3 text-base text-white">
          {databaseError}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        {counts.map((count, index) => (
          <Card key={count.label} className={`border-t-4 ${COUNT_ACCENTS[index] ?? "border-t-primary"}`}>
            <CardHeader>
              <CardTitle className="text-base font-medium text-muted-foreground">{count.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-semibold tabular-nums tracking-tight">{count.value ?? "—"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card px-6 py-5">
        <h2 className="text-lg font-semibold">O que já dá para fazer</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-base leading-7">
          <li>Criar projetos e importar áudios autorizados.</li>
          <li>Acompanhar a transcrição, renomear participantes e corrigir trechos.</li>
          <li>Ver a nuvem de palavras, os indicadores e baixar o relatório.</li>
        </ul>
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<p className="text-lg text-muted-foreground">Carregando painel…</p>}>
      <DashboardContent />
    </Suspense>
  )
}
