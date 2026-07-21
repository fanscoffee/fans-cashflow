"use client"

import { useState } from "react"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import NotificationBell from "@/components/notification-bell"

interface HeaderLink {
  href: string
  label: string
}

function getNavLinks(role?: string): HeaderLink[] {
  if (role === "ADMIN") {
    return [
      { href: "/socio", label: "Dashboard" },
      { href: "/socio/fondo", label: "Fondo" },
      { href: "/socio/turnos", label: "Turnos" },
      { href: "/socio/efectivo", label: "Efectivo" },
      { href: "/orders", label: "Encargos" },
      { href: "/empleado", label: "Turno" },
      { href: "/admin", label: "Admin" },
    ]
  }
  if (role === "SOCIO") {
    return [
      { href: "/socio", label: "Dashboard" },
      { href: "/socio/fondo", label: "Fondo" },
      { href: "/socio/turnos", label: "Turnos" },
      { href: "/socio/efectivo", label: "Efectivo" },
      { href: "/orders", label: "Encargos" },
      { href: "/empleado", label: "Turno" },
    ]
  }
  if (role === "EMPLEADO") {
    return [
      { href: "/empleado", label: "Turno" },
      { href: "/orders", label: "Encargos" },
    ]
  }
  if (role === "OBRADOR") {
    return [
      { href: "/orders", label: "Encargos" },
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
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const roleLinks = getNavLinks(session?.user?.role)
  const navLinks = links && links.length > 0 ? links : roleLinks

  function isActive(href: string) {
    if (href === "/socio") return pathname === "/socio"
    return pathname.startsWith(href)
  }

  return (
    <header className="border-b bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Image
            src="/fans-logo-oscuro.png"
            alt="Fans"
            width={80}
            height={80}
            className="rounded"
          />
          <div>
            <h1 className="text-lg font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 sm:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="ml-2 border-l border-gray-200 pl-2">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              Salir
            </button>
          </div>
        </nav>

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

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t bg-white px-4 py-3 sm:hidden">
          <div className="flex flex-wrap gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  isActive(link.href)
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-3 w-full rounded-md border border-gray-200 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900"
          >
            Cerrar sesión
          </button>
        </div>
      )}

      <NotificationBell />
    </header>
  )
}
