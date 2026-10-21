import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProfileForm } from "@/components/settings/profile-form"
import { readServerSecretPresence } from "@/domain/env"
import { getCurrentUser } from "@/server/auth/current-user"
import { createClient } from "@/lib/supabase/server"

const SECRET_ROWS = [
  { key: "supabaseServiceRole" as const, label: "SUPABASE_SERVICE_ROLE_KEY" },
  { key: "redis" as const, label: "REDIS_URL" },
]

async function SettingsContent() {
  const user = await getCurrentUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle()
  const presence = readServerSecretPresence(process.env)

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-3 text-lg leading-8 text-muted-foreground">
          Conta {user.email ?? "sem e-mail no token"}.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>O nome de exibição não identifica participantes de um áudio.</CardDescription>
        </CardHeader>
        <CardContent>
          {error || !data ? (
            <p role="alert" className="rounded-lg bg-destructive px-4 py-3 text-base text-white">
              O perfil não foi encontrado. Confirme o gatilho de cadastro na migração do banco.
            </p>
          ) : (
            <ProfileForm displayName={data.display_name} />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Privacidade</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-base leading-7">
          <p>
            A transcrição acontece neste servidor. O áudio não é enviado a um serviço externo de transcrição.
          </p>
          <p>
            A importação só segue depois da confirmação de que você tem autorização para tratar o áudio.
          </p>
          <p>
            Os arquivos ficam em um bucket privado. As tabelas usam Row Level Security para limitar o acesso à conta autenticada. A reprodução usa uma URL assinada que expira em 30 minutos.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Variáveis do servidor</CardTitle>
          <CardDescription>A tela mostra apenas se o valor existe. O conteúdo não é exibido.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {SECRET_ROWS.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-4 rounded-lg bg-secondary px-4 py-3">
                <span className="font-mono text-sm text-foreground">{row.label}</span>
                <span
                  className={
                    presence[row.key]
                      ? "rounded-md bg-primary px-2.5 py-1 text-sm font-semibold text-primary-foreground"
                      : "rounded-md bg-warning px-2.5 py-1 text-sm font-semibold text-warning-foreground"
                  }
                >
                  {presence[row.key] ? "definida" : "ausente"}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-lg text-muted-foreground">Carregando configurações…</p>}>
      <SettingsContent />
    </Suspense>
  )
}
