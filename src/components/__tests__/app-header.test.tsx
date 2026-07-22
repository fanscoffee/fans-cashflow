import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import AppHeader from "../app-header"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}))

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, ...rest } = props
    return <img src={src as string} alt={alt as string} {...rest} />
  },
}))

vi.mock("@/components/notification-bell", () => ({
  default: () => <div data-testid="notification-bell" />,
}))

import { useSession, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"

describe("AppHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: "ADMIN" } },
      status: "authenticated",
      update: vi.fn(),
    } as any)
    vi.mocked(usePathname).mockReturnValue("/socio")
  })

  it("renders title and subtitle", () => {
    render(<AppHeader title="Fans Cashflow" subtitle="My Subtitle" />)
    expect(screen.getByText("Fans Cashflow")).toBeInTheDocument()
    expect(screen.getByText("My Subtitle")).toBeInTheDocument()
  })

  it("renders nav links for ADMIN role", () => {
    render(<AppHeader title="Fans Cashflow" />)
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Fondo" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Turnos" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Efectivo" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Encargos" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Turno" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Admin" })).toBeInTheDocument()
  })

  it("renders limited nav links for EMPLEADO role", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: "EMPLEADO" } },
      status: "authenticated",
      update: vi.fn(),
    } as any)
    render(<AppHeader title="Fans Cashflow" />)
    expect(screen.getByRole("link", { name: "Turno" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Encargos" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument()
  })

  it("renders custom links when provided", () => {
    const customLinks = [
      { href: "/custom", label: "CustomLink" },
    ]
    render(<AppHeader title="Fans Cashflow" links={customLinks} />)
    expect(screen.getByRole("link", { name: "CustomLink" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument()
  })

  it("calls signOut when Salir is clicked", () => {
    render(<AppHeader title="Fans Cashflow" />)
    fireEvent.click(screen.getByText("Salir"))
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" })
  })

  it("toggles mobile menu on hamburger click", () => {
    render(<AppHeader title="Fans Cashflow" />)
    const hamburger = screen.getByLabelText("Menú")
    fireEvent.click(hamburger)
    expect(screen.getByText("Cerrar sesión")).toBeInTheDocument()
  })
})
