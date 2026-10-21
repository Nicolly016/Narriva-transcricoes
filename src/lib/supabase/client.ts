import { createBrowserClient } from "@supabase/ssr"
import { readPublicSupabaseConfig } from "@/domain/env"
import type { Database } from "@/lib/database.types"

export function createClient() {
  // The browser bundle only inlines NEXT_PUBLIC_* when the property is read by name.
  const config = readPublicSupabaseConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })
  if (!config.ok) {
    throw new Error("Supabase não está configurado.")
  }

  return createBrowserClient<Database>(config.config.url, config.config.publishableKey)
}
