import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { readPublicSupabaseConfig } from "@/domain/env"
import type { Database } from "@/lib/database.types"

export async function createClient() {
  const config = readPublicSupabaseConfig(process.env)
  if (!config.ok) {
    throw new Error("Supabase não está configurado.")
  }

  const cookieStore = await cookies()

  return createServerClient<Database>(config.config.url, config.config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet, headers) {
        void headers
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot write cookies. The proxy refreshes the session.
        }
      },
    },
  })
}
