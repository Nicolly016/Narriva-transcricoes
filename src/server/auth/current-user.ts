import "server-only"

import { connection } from "next/server"
import { redirect } from "next/navigation"
import { readPublicSupabaseConfig } from "@/domain/env"
import { createClient } from "@/lib/supabase/server"

export type CurrentUser = {
  id: string
  email: string | null
}

export async function getCurrentUser(): Promise<CurrentUser> {
  await connection()

  if (!readPublicSupabaseConfig(process.env).ok) {
    redirect("/login")
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (error || !userId) {
    redirect("/login")
  }

  const emailClaim = data.claims.email
  return {
    id: userId,
    email: typeof emailClaim === "string" ? emailClaim : null,
  }
}
