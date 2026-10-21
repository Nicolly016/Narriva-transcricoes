"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { readPublicSupabaseConfig } from "@/domain/env"
import { createClient } from "@/lib/supabase/server"

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
})

function authErrorMessage(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos."
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirme o e-mail antes de entrar."
  }
  if (normalized.includes("already registered") || normalized.includes("already been registered")) {
    return "Já existe uma conta com este e-mail."
  }
  return "Não foi possível autenticar. Tente novamente."
}

async function originFromHeaders(): Promise<string> {
  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host")
  const proto = headerList.get("x-forwarded-proto") ?? "http"
  if (!host) {
    return "http://localhost:3000"
  }
  return `${proto}://${host}`
}

export async function signIn(formData: FormData) {
  if (!readPublicSupabaseConfig(process.env).ok) {
    redirect("/login?error=config")
  }

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    redirect("/login?error=credenciais")
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    redirect(`/login?error=${encodeURIComponent(authErrorMessage(error.message))}`)
  }

  redirect("/")
}

export async function signUp(formData: FormData) {
  if (!readPublicSupabaseConfig(process.env).ok) {
    redirect("/signup?error=config")
  }

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  const displayName = z.string().trim().max(80).safeParse(formData.get("displayName") ?? "")
  if (!parsed.success || !displayName.success) {
    redirect("/signup?error=credenciais")
  }

  const supabase = await createClient()
  const origin = await originFromHeaders()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        display_name: displayName.data,
      },
    },
  })

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(authErrorMessage(error.message))}`)
  }

  if (data.session) {
    redirect("/")
  }

  redirect("/login?notice=confirmacao")
}

export async function signOut() {
  if (readPublicSupabaseConfig(process.env).ok) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
  redirect("/login")
}
