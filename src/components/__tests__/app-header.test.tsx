import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import AppHeader from "../app-header"

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "1", email: "test@test.com", name: "Test User", role: "ADMIN" } },
    status: "authenticated",
  }),
  signOut: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/orders",
}))

vi.mock("@/components/notification-bell", () => ({
  default: () => <div data-testid="notification-bell" />,
}))

describe("AppHeader", () => {
  it("renders title", () => {
    render(<AppHeader title="Fans Cashflow" />)
    expect(screen.getByText("Fans Cashflow")).toBeInTheDocument()
  })

  it("renders subtitle when provided", () => {
    const { container } = render(<AppHeader title="Fans Cashflow" subtitle="Encargos" />)
    const subtitle = container.querySelector("p")
    expect(subtitle).toBeInTheDocument()
    expect(subtitle!.textContent).toBe("Encargos")
  })

  it("renders nav links for ADMIN role", () => {
    render(<AppHeader title="Fans Cashflow" />)
    expect(screen.getByText("Dashboard")).toBeInTheDocument()
    expect(screen.getByText("Fondo")).toBeInTheDocument()
    expect(screen.getByText("Turnos")).toBeInTheDocument()
    expect(screen.getByText("Efectivo")).toBeInTheDocument()
    expect(screen.getByText("Encargos")).toBeInTheDocument()
    expect(screen.getByText("Admin")).toBeInTheDocument()
  })

  it("renders sign out button", () => {
    render(<AppHeader title="Fans Cashflow" />)
    expect(screen.getByText("Salir")).toBeInTheDocument()
  })

  it("renders hamburger menu button for mobile", () => {
    render(<AppHeader title="Fans Cashflow" />)
    expect(screen.getByRole("button", { name: /menú/i })).toBeInTheDocument()
  })

  it("opens mobile menu on hamburger click", async () => {
    const user = userEvent.setup()
    render(<AppHeader title="Fans Cashflow" />)
    await user.click(screen.getByRole("button", { name: /menú/i }))
    expect(screen.getByText("Cerrar sesión")).toBeInTheDocument()
  })

  it("renders NotificationBell", () => {
    render(<AppHeader title="Fans Cashflow" />)
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument()
  })

  it("uses custom links when provided", () => {
    render(
      <AppHeader
        title="Fans Cashflow"
        links={[{ href: "/custom", label: "Custom Link" }]}
      />
    )
    expect(screen.getByText("Custom Link")).toBeInTheDocument()
  })
})
