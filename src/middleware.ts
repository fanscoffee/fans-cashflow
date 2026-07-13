import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

const ROLE_REDIRECT: Record<string, string> = {
  ADMIN: "/admin",
  SOCIO: "/socio",
  EMPLEADO: "/empleado",
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  const isLoginPage = pathname === "/" || pathname === "/login"
  const isDashboardPage = pathname.startsWith("/admin") || pathname.startsWith("/socio") || pathname.startsWith("/empleado")

  // Logged in user visiting login/root → redirect to their dashboard
  if (token && isLoginPage) {
    const role = token.role as string
    return NextResponse.redirect(new URL(ROLE_REDIRECT[role] ?? "/empleado", req.url))
  }

  // Not logged in visiting dashboard → redirect to login (root)
  if (!token && isDashboardPage) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  // Logged in user on dashboard → role check
  if (token && isDashboardPage) {
    const role = token.role as string

    if (role === "ADMIN" || role === "SOCIO") return NextResponse.next()

    const allowedPrefix = `/${role.toLowerCase()}`

    if (!pathname.startsWith(allowedPrefix)) {
      return NextResponse.redirect(new URL(allowedPrefix, req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/socio/:path*", "/empleado/:path*"],
}
