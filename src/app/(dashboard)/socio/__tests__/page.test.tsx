import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "1", name: "Socio User", email: "socio@test.com", role: "SOCIO" } },
    status: "authenticated",
  }),
}))

vi.mock("@/components/dashboard", () => ({
  default: () => <div data-testid="dashboard">Dashboard Component</div>,
}))

vi.mock("@/components/passkey-manager", () => ({
  default: () => <div data-testid="passkey-manager">Passkey Manager</div>,
}))

vi.mock("@/components/app-header", () => ({
  default: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <header>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  ),
}))

import SocioPage from "../page"

describe("SocioPage", () => {
  it("renders page title and subtitle", () => {
    render(<SocioPage />)
    expect(screen.getByText("Fans Cashflow")).toBeInTheDocument()
    expect(screen.getByText(/Socio/)).toBeInTheDocument()
  })

  it("renders Dashboard component", () => {
    render(<SocioPage />)
    expect(screen.getByTestId("dashboard")).toBeInTheDocument()
  })

  it("renders PasskeyManager component", () => {
    render(<SocioPage />)
    expect(screen.getByTestId("passkey-manager")).toBeInTheDocument()
  })
})
