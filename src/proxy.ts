import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole, isRole, normalizeRole, ROLE_REDIRECT } from "@/lib/roles"

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  const isLoginPage = pathname === "/" || pathname === "/login"
  const isDashboardPage = pathname.startsWith("/admin") || pathname.startsWith("/socio") || pathname.startsWith("/empleado")
  const isAccountingPage = pathname.startsWith("/gestoria")
  const isOrdersPage = pathname.startsWith("/encargos")

  // Logged in user visiting login/root → redirect to their dashboard
  if (session && isLoginPage) {
    const role = normalizeRole(session.user?.role)
    return NextResponse.redirect(new URL(ROLE_REDIRECT[role ?? ""] ?? "/", req.url))
  }

  // Not logged in visiting dashboard or orders → redirect to login (root)
  if (!session && (isDashboardPage || isAccountingPage || isOrdersPage)) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  // Logged in user on dashboard → role check
  if (session && (isDashboardPage || isAccountingPage)) {
    const role = session.user?.role as string

    if (hasAnyRole(role, [UserRole.ADMIN, UserRole.PARTNER])) return NextResponse.next()

    if (isRole(role, UserRole.BAKERY)) {
      return NextResponse.redirect(new URL("/encargos", req.url))
    }

    const normalizedRole = normalizeRole(role)
    const allowedPrefix = `/${normalizedRole?.toLowerCase() || ""}`

    if (!pathname.startsWith(allowedPrefix)) {
      return NextResponse.redirect(new URL(allowedPrefix, req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/socio/:path*", "/empleado/:path*", "/gestoria/:path*", "/encargos/:path*"],
}
