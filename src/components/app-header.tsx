"use client"

import { useEffect, useRef, useState } from "react"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import NotificationBell from "@/components/notification-bell"
import { UserRole } from "@/lib/database-enums"
import { normalizeRole } from "@/lib/roles"

interface HeaderLink {
  href: string
  label: string
}

interface HeaderGroup {
  id: string
  label: string
  links: HeaderLink[]
}

interface HeaderNavigation {
  primary: HeaderLink[]
  groups: HeaderGroup[]
  utility: HeaderLink[]
}

function getNavigation(role?: string): HeaderNavigation {
  const normalizedRole = normalizeRole(role)
  const groups: HeaderGroup[] = [
    {
      id: "operativa",
      label: "Operativa",
      links: [
        { href: "/socio/fondo", label: "Fondo" },
        { href: "/socio/historial-turnos", label: "Historial de Turnos" },
        { href: "/socio/efectivo", label: "Efectivo" },
        { href: "/empleado", label: "Turno" },
      ],
    },
    {
      id: "gestion",
      label: "Gestión",
      links: [
        { href: "/socio/inventario", label: "Inventario" },
        { href: "/socio/facturas", label: "Facturas" },
        { href: "/gestoria", label: "Gestoría" },
        { href: "/socio/pagos", label: "Pagos" },
        { href: "/encargos", label: "Encargos" },
      ],
    },
  ]

  if (normalizedRole === UserRole.ADMIN) {
    return {
      primary: [{ href: "/socio", label: "Dashboard" }],
      groups: groups.map((group) => ({
        ...group,
        links: group.links.map((link) => link.href === "/socio/inventario"
          ? { ...link, href: "/admin/inventario" }
          : link.href === "/socio/facturas"
            ? { ...link, href: "/admin/facturas" }
            : link.href === "/socio/pagos"
              ? { ...link, href: "/admin/pagos" }
              : link),
      })),
      utility: [{ href: "/admin", label: "Admin" }],
    }
  }
  if (normalizedRole === UserRole.PARTNER) {
    return {
      primary: [{ href: "/socio", label: "Dashboard" }],
      groups,
      utility: [],
    }
  }
  if (normalizedRole === UserRole.EMPLOYEE) {
    return {
      primary: [
        { href: "/empleado", label: "Turno" },
        { href: "/empleado/recepciones", label: "Recepciones" },
        { href: "/encargos", label: "Encargos" },
      ],
      groups: [],
      utility: [],
    }
  }
  if (normalizedRole === UserRole.BAKERY) {
    return { primary: [{ href: "/encargos", label: "Encargos" }], groups: [], utility: [] }
  }
  return { primary: [], groups: [], utility: [] }
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
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const desktopNavRef = useRef<HTMLDivElement>(null)

  const navigation: HeaderNavigation = links && links.length > 0
    ? { primary: links, groups: [], utility: [] }
    : getNavigation(session?.user?.role)

  function isActive(href: string) {
    if (href === "/socio" || href === "/empleado" || href === "/admin") return pathname === href
    return pathname.startsWith(href)
  }

  function isGroupActive(group: HeaderGroup) {
    return group.links.some((link) => isActive(link.href))
  }

  function closeMenus() {
    setOpenMenu(null)
    setMenuOpen(false)
  }

  useEffect(() => {
    if (!openMenu) return

    function handlePointerDown(event: PointerEvent) {
      if (!desktopNavRef.current?.contains(event.target as Node)) setOpenMenu(null)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenu(null)
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [openMenu])

  function handleSignOut() {
    void signOut({ callbackUrl: "/login" })
  }

  return (
    <header className="relative border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Image
            src="/fans-logo-oscuro.png"
            alt="Fans"
            width={160}
            height={84}
            className="h-auto w-14 shrink-0 rounded object-contain sm:w-20"
          />
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-gray-900 sm:text-lg">{title}</h1>
            {subtitle && <p className="break-words text-xs text-gray-500 [overflow-wrap:anywhere]">{subtitle}</p>}
          </div>
        </div>

        <div ref={desktopNavRef} className="hidden items-center gap-1 sm:flex">
          <nav aria-label="Navegación principal" className="flex items-center gap-1">
            {navigation.primary.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenus}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive(link.href)
                    ? "bg-gray-900 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {link.label}
              </Link>
            ))}

            {navigation.groups.map((group) => {
              const active = isGroupActive(group)
              const expanded = openMenu === group.id
              return (
                <div key={group.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenMenu((current) => current === group.id ? null : group.id)}
                    aria-expanded={expanded}
                    aria-controls={`${group.id}-menu`}
                    className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      active || expanded
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    {group.label}
                    <svg aria-hidden="true" className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {expanded && (
                    <div id={`${group.id}-menu`} className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-xl shadow-gray-900/10">
                      <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">{group.label}</p>
                      <div className="space-y-1">
                        {group.links.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={closeMenus}
                            aria-current={isActive(link.href) ? "page" : undefined}
                            className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
                              isActive(link.href)
                                ? "bg-gray-900 font-semibold text-white"
                                : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                            }`}
                          >
                            {link.label}
                            {isActive(link.href) && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {navigation.utility.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenus}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive(link.href)
                    ? "bg-gray-900 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-2 border-l border-gray-200 pl-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              Salir
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { setMenuOpen((current) => !current); setOpenMenu(null) }}
          className="min-h-11 min-w-11 shrink-0 rounded-lg border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-100 sm:hidden"
          aria-label="Menú"
          aria-expanded={menuOpen}
          aria-controls="fans-main-navigation"
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

      {menuOpen && (
        <div id="fans-main-navigation" className="border-t border-gray-100 bg-gray-50/80 px-4 py-4 sm:hidden">
          <nav aria-label="Navegación móvil" className="space-y-4">
            {navigation.primary.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {navigation.primary.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeMenus}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={`flex min-h-11 items-center justify-center rounded-lg px-2 py-2 text-center text-sm font-semibold transition-colors ${
                      isActive(link.href)
                        ? "bg-gray-900 text-white shadow-sm"
                        : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {navigation.groups.map((group) => (
              <section key={group.id}>
                <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">{group.label}</h2>
                <div className="grid grid-cols-2 gap-2">
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMenus}
                      aria-current={isActive(link.href) ? "page" : undefined}
                      className={`flex min-h-11 items-center justify-center rounded-lg px-2 py-2 text-center text-sm font-medium transition-colors ${
                        isActive(link.href)
                          ? "bg-gray-900 text-white shadow-sm"
                          : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </section>
            ))}

            {navigation.utility.length > 0 && (
              <section>
                <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Administración</h2>
                <div className="grid grid-cols-2 gap-2">
                  {navigation.utility.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMenus}
                      aria-current={isActive(link.href) ? "page" : undefined}
                      className={`flex min-h-11 items-center justify-center rounded-lg px-2 py-2 text-center text-sm font-medium transition-colors ${
                        isActive(link.href)
                          ? "bg-gray-900 text-white shadow-sm"
                          : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </nav>

          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 min-h-11 w-full rounded-lg border border-gray-200 bg-white py-2 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            Cerrar sesión
          </button>
        </div>
      )}

      <NotificationBell />
    </header>
  )
}
