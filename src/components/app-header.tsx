"use client"

import { useState } from "react"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"

interface HeaderLink {
  href: string
  label: string
  variant?: "primary" | "default"
}

function getNavLinks(role?: string): HeaderLink[] {
  if (role === "ADMIN") {
    return [
      { href: "/socio", label: "Dashboard" },
      { href: "/socio/fondo", label: "Fondo" },
      { href: "/socio/turnos", label: "Turnos" },
      { href: "/socio/efectivo", label: "Efectivo" },
      { href: "/empleado", label: "Empleado" },
      { href: "/admin", label: "Admin" },
    ]
  }
  if (role === "SOCIO") {
    return [
      { href: "/socio", label: "Dashboard" },
      { href: "/socio/fondo", label: "Fondo" },
      { href: "/socio/turnos", label: "Turnos" },
      { href: "/socio/efectivo", label: "Efectivo" },
      { href: "/empleado", label: "Empleado" },
    ]
  }
  return []
}

export default function AppHeader({
  title,
  subtitle,
  links,
}: {
  title: string
  subtitle?: string
  links?: HeaderLink[]
}) {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)

  const roleLinks = getNavLinks(session?.user?.role)
  const navLinks = links && links.length > 0 ? links : roleLinks

  return (
    <header className="border-b bg-white shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>

        {/* Desktop */}
        <div className="hidden items-center gap-2 sm:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                link.variant === "primary"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-gray-600 hover:bg-gray-700"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-md p-2 text-gray-600 hover:bg-gray-100 sm:hidden"
          aria-label="Menú"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div className="border-t bg-white px-4 py-3 sm:hidden">
          <div className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-md px-4 py-2 text-sm font-medium text-center text-white ${
                  link.variant === "primary"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-600 hover:bg-gray-700"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
