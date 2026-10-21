const PUBLIC_PREFIXES = ["/auth/"] as const

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/signup" || pathname === "/apresentacao") {
    return true
  }
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function canAccessOwnedResource(actorId: string, ownerId: string): boolean {
  return actorId.length > 0 && actorId === ownerId
}

/** Relative in-app paths only. Blocks protocol-relative and external redirects. */
export function safeRedirectPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/"
  }
  if (value.includes("://")) {
    return "/"
  }
  return value
}
