import { describe, expect, it } from "vitest"
import { canAccessOwnedResource, isPublicPath, safeRedirectPath } from "./access"

describe("access", () => {
  it("keeps authentication routes public", () => {
    expect(isPublicPath("/login")).toBe(true)
    expect(isPublicPath("/signup")).toBe(true)
    expect(isPublicPath("/apresentacao")).toBe(true)
    expect(isPublicPath("/auth/callback")).toBe(true)
    expect(isPublicPath("/projetos")).toBe(false)
    expect(isPublicPath("/")).toBe(false)
  })

  it("allows access only to the owner's records", () => {
    expect(canAccessOwnedResource("user-1", "user-1")).toBe(true)
    expect(canAccessOwnedResource("user-1", "user-2")).toBe(false)
    expect(canAccessOwnedResource("", "user-2")).toBe(false)
  })

  it("rejects external redirect targets", () => {
    expect(safeRedirectPath("/projetos")).toBe("/projetos")
    expect(safeRedirectPath("//evil.example")).toBe("/")
    expect(safeRedirectPath("https://evil.example")).toBe("/")
    expect(safeRedirectPath(null)).toBe("/")
  })
})
