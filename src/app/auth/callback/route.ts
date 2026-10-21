import { NextResponse } from "next/server"
import { safeRedirectPath } from "@/domain/access"
import { readPublicSupabaseConfig } from "@/domain/env"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (!readPublicSupabaseConfig(process.env).ok) {
    return NextResponse.redirect(new URL("/login?error=config", url.origin))
  }

  const code = url.searchParams.get("code")
  const next = safeRedirectPath(url.searchParams.get("next"))
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=confirmacao", url.origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(new URL("/login?error=confirmacao", url.origin))
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
