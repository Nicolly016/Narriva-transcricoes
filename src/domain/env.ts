export type PublicSupabaseConfig = {
  url: string
  publishableKey: string
}

export type PublicEnvResult =
  | { ok: true; config: PublicSupabaseConfig }
  | { ok: false; missing: string[] }

const URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i

export function readPublicSupabaseConfig(
  source: Record<string, string | undefined>,
): PublicEnvResult {
  const url = source.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""
  const publishableKey = (
    source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    source.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim()

  const missing: string[] = []
  if (!url || !URL_PATTERN.test(url)) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL")
  }
  if (!publishableKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  }
  if (missing.length > 0) {
    return { ok: false, missing }
  }

  return {
    ok: true,
    config: { url, publishableKey },
  }
}

export type ServerSecretPresence = {
  supabaseServiceRole: boolean
  redis: boolean
}

export function readServerSecretPresence(
  source: Record<string, string | undefined>,
): ServerSecretPresence {
  return {
    supabaseServiceRole: Boolean(source.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    redis: Boolean(source.REDIS_URL?.trim()),
  }
}
