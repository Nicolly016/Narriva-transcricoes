import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ImportForm } from "@/components/import/import-form"
import { ACCEPTED_AUDIO_LABEL } from "@/domain/storage-path"
import { getCurrentUser } from "@/server/auth/current-user"
import { createClient } from "@/lib/supabase/server"

async function ImportContent({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams
  const serverError = typeof params.error === "string" ? params.error.slice(0, 300) : null
  const user = await getCurrentUser()
  const supabase = await createClient()
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Importar áudios</h1>
        <p className="mt-3 text-lg leading-8 text-muted-foreground">
          O arquivo fica no armazenamento privado da sua conta. Em seguida este servidor escreve o que foi falado, em português. A primeira transcrição baixa o modelo de reconhecimento; as seguintes usam a cópia já salva neste computador. Áudios acima de 2 horas não são transcritos.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Novo áudio</CardTitle>
          <CardDescription>{ACCEPTED_AUDIO_LABEL}, até 500 MB no armazenamento.</CardDescription>
        </CardHeader>
        <CardContent>
          <ImportForm projects={projects ?? []} serverError={serverError} />
        </CardContent>
      </Card>
    </section>
  )
}

export default function ImportPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <Suspense fallback={<p className="text-lg text-muted-foreground">Carregando importação…</p>}>
      <ImportContent searchParams={searchParams} />
    </Suspense>
  )
}
