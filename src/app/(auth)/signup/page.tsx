import Link from "next/link"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { readPublicSupabaseConfig } from "@/domain/env"
import { signUp } from "@/server/auth/actions"

function signupMessage(error: string | undefined): string | null {
  if (error === "config") {
    return "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
  }
  if (error === "credenciais") {
    return "Informe um e-mail válido e uma senha com pelo menos 8 caracteres."
  }
  return error ?? null
}

async function SignupForm({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams
  const configured = readPublicSupabaseConfig(process.env).ok
  const message = signupMessage(params.error)

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl">Criar conta</CardTitle>
        <CardDescription className="break-words">
          A senha fica no Supabase Auth. Ela não é gravada pela aplicação.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={signUp} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="displayName">Nome de exibição</Label>
            <Input id="displayName" name="displayName" autoComplete="name" maxLength={80} disabled={!configured} />
          </div>
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
              autoComplete="new-password"
              required
              minLength={8}
              disabled={!configured}
            />
          </div>
          {message ? (
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
            Criar conta
          </Button>
        </form>
        <p className="mt-5 text-base text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

export default function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
      <SignupForm searchParams={searchParams} />
    </Suspense>
  )
}
