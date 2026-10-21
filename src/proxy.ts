import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isPublicPath } from "@/domain/access"
import { readPublicSupabaseConfig } from "@/domain/env"

function copyAuthResponse(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value)
  })
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header)
    if (value) {
      to.headers.set(header, value)
    }
  }
  return to
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const config = readPublicSupabaseConfig(process.env)

  if (!config.ok) {
    if (isPublicPath(pathname)) {
      return NextResponse.next()
    }
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(config.config.url, config.config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value)
        })
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub

  if (!userId && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/apresentacao"
    return copyAuthResponse(supabaseResponse, NextResponse.redirect(url))
  }

  if (userId && (pathname === "/login" || pathname === "/signup" || pathname === "/apresentacao")) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return copyAuthResponse(supabaseResponse, NextResponse.redirect(url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
