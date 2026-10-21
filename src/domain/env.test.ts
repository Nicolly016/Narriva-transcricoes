import { describe, expect, it } from "vitest"
import { readPublicSupabaseConfig, readServerSecretPresence } from "./env"

describe("environment", () => {
  it("returns only the public Supabase fields", () => {
    const result = readPublicSupabaseConfig({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
      SECRET_KEY: "sk-secret",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.config).toEqual({
      url: "http://127.0.0.1:54321",
      publishableKey: "publishable",
    })
    expect(JSON.stringify(result.config)).not.toContain("sk-secret")
    expect(JSON.stringify(result.config)).not.toContain("service-role")
  })

  it("accepts the legacy anon key name when the publishable key is absent", () => {
    const result = readPublicSupabaseConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    })
    expect(result.ok).toBe(true)
  })

  it("reports missing public configuration", () => {
    const result = readPublicSupabaseConfig({})
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.missing).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ])
  })

  it("reports secret presence without returning the values", () => {
    const presence = readServerSecretPresence({
      SUPABASE_SERVICE_ROLE_KEY: "service",
      REDIS_URL: "redis://localhost:6379",
    })
    expect(presence).toEqual({
      supabaseServiceRole: true,
      redis: true,
    })
  })
})
