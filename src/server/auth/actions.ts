"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { readPublicSupabaseConfig } from "@/domain/env"
import { createServiceRoleClient } from "@/lib/supabase/admin"
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
  if (isAlreadyRegistered(message)) {
    return "Já existe uma conta com este e-mail."
  }
  return "Não foi possível autenticar. Tente novamente."
}

function isAlreadyRegistered(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes("already registered") || normalized.includes("already been registered")
}

async function confirmEmail(email: string) {
  const admin = createServiceRoleClient()
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error || data.users.length === 0) {
      return
    }
    const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase())
    if (user) {
      if (!user.email_confirmed_at) {
        await admin.auth.admin.updateUserById(user.id, { email_confirm: true })
      }
      return
    }
    if (data.users.length < 200) {
      return
    }
  }
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
  let { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error?.message.toLowerCase().includes("email not confirmed")) {
    await confirmEmail(parsed.data.email)
    const retry = await supabase.auth.signInWithPassword(parsed.data)
    error = retry.error
  }
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

  const admin = createServiceRoleClient()
  const { error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName.data,
    },
  })

  if (createError && !isAlreadyRegistered(createError.message)) {
    redirect(`/signup?error=${encodeURIComponent(authErrorMessage(createError.message))}`)
  }
  if (createError) {
    await confirmEmail(parsed.data.email)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    const message = isAlreadyRegistered(createError?.message ?? "")
      ? "Já existe uma conta com este e-mail."
      : authErrorMessage(error.message)
    redirect(`/signup?error=${encodeURIComponent(message)}`)
  }

  redirect("/")
}

export async function signOut() {
  if (readPublicSupabaseConfig(process.env).ok) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
  redirect("/login")
}
