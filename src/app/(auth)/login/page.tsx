import Link from "next/link"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { readPublicSupabaseConfig } from "@/domain/env"
import { signIn } from "@/server/auth/actions"

function loginMessage(error: string | undefined, notice: string | undefined): string | null {
  if (notice === "confirmacao") {
    return "Conta criada. Se a confirmação de e-mail estiver ativa, use o link recebido antes de entrar."
  }
  if (error === "config") {
    return "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
  }
  if (error === "credenciais") {
    return "Informe um e-mail válido e uma senha com pelo menos 8 caracteres."
  }
  if (error === "confirmacao") {
    return "Não foi possível concluir a confirmação do acesso."
  }
  return error ?? null
}

async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const params = await searchParams
  const configured = readPublicSupabaseConfig(process.env).ok
  const message = loginMessage(params.error, params.notice)

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl">Entrar</CardTitle>
        <CardDescription className="break-words">
          Acesso à plataforma de transcrição e análise de áudios.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={signIn} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required disabled={!configured} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              disabled={!configured}
            />
          </div>
          {params.notice === "confirmacao" ? (
            <p className="text-base leading-7 text-muted-foreground">{message}</p>
          ) : null}
          {params.error && message ? (
            <p role="alert" className="text-base leading-7 text-destructive">
              {message}
            </p>
          ) : null}
          {!configured ? (
            <p role="alert" className="text-base leading-7 text-destructive">
              O Supabase ainda não está configurado neste ambiente.
            </p>
          ) : null}
          <Button type="submit" disabled={!configured} className="mt-1 w-full">
            Entrar
          </Button>
        </form>
        <p className="mt-5 text-base text-muted-foreground">
          Não tem conta?{" "}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Criar conta
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
      <LoginForm searchParams={searchParams} />
    </Suspense>
  )
}
