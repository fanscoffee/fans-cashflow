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

import PartnerPage from "../page"

describe("PartnerPage", () => {
  it("renders page title and subtitle", () => {
    render(<PartnerPage />)
    expect(screen.getByText("Fans Cashflow")).toBeInTheDocument()
    expect(screen.getByText(/Socio/)).toBeInTheDocument()
  })

  it("renders Dashboard component", () => {
    render(<PartnerPage />)
    expect(screen.getByTestId("dashboard")).toBeInTheDocument()
  })

  it("renders PasskeyManager component", () => {
    render(<PartnerPage />)
    expect(screen.getByTestId("passkey-manager")).toBeInTheDocument()
  })
})
