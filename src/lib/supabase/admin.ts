import "server-only"

import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { readPublicSupabaseConfig } from "@/domain/env"

export function createServiceRoleClient() {
  const config = readPublicSupabaseConfig(process.env)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!config.ok || !serviceRoleKey) {
    throw new Error("O cliente administrativo do Supabase não está configurado.")
  }

  return createClient<Database>(config.config.url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
