import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DeleteProjectButton } from "@/components/projects/delete-project-button"
import { ProjectForm } from "@/components/projects/project-form"
import { getCurrentUser } from "@/server/auth/current-user"
import { createClient } from "@/lib/supabase/server"

async function ProjectsContent() {
  const user = await getCurrentUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, description, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Meus projetos</h1>
        <p className="mt-3 max-w-2xl text-lg leading-8 text-muted-foreground">
          Os projetos agrupam áudios. O vínculo é escolhido na importação.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Novo projeto</CardTitle>
          <CardDescription>Título e descrição ficam visíveis apenas para a sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectForm />
        </CardContent>
      </Card>
      {error ? (
        <p role="alert" className="rounded-lg bg-destructive px-4 py-3 text-base text-white">
          Não foi possível listar os projetos. Aplique a migração do banco e tente novamente.
        </p>
      ) : null}
      {!error && data?.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-5 py-4 text-base text-muted-foreground">
          Nenhum projeto criado.
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {data?.map((project) => (
          <li key={project.id}>
            <Card>
              <CardHeader>
                <CardTitle>{project.title}</CardTitle>
                <CardDescription>
                  Criado em{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(project.created_at))}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {project.description ? <p className="text-base leading-7">{project.description}</p> : null}
                <DeleteProjectButton projectId={project.id} />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<p className="text-lg text-muted-foreground">Carregando projetos…</p>}>
      <ProjectsContent />
    </Suspense>
  )
}
