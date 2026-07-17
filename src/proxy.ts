import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

const ROLE_REDIRECT: Record<string, string> = {
  ADMIN: "/admin",
  SOCIO: "/socio",
  EMPLEADO: "/empleado",
}

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  const isLoginPage = pathname === "/" || pathname === "/login"
  const isDashboardPage = pathname.startsWith("/admin") || pathname.startsWith("/socio") || pathname.startsWith("/empleado")
  const isOrdersPage = pathname.startsWith("/orders")

  // Logged in user visiting login/root → redirect to their dashboard
  if (session && isLoginPage) {
    const role = session.user?.role as string
    return NextResponse.redirect(new URL(ROLE_REDIRECT[role] ?? "/empleado", req.url))
  }

  // Not logged in visiting dashboard or orders → redirect to login (root)
  if (!session && (isDashboardPage || isOrdersPage)) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  // Logged in user on dashboard → role check
  if (session && isDashboardPage) {
    const role = session.user?.role as string

    if (role === "ADMIN" || role === "SOCIO") return NextResponse.next()

    const allowedPrefix = `/${role.toLowerCase()}`

    if (!pathname.startsWith(allowedPrefix)) {
      return NextResponse.redirect(new URL(allowedPrefix, req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/socio/:path*", "/empleado/:path*", "/orders/:path*"],
}
