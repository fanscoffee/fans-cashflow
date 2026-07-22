import { render, screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const mockAdditions = [
  {
    id: "a1",
    amount: 200,
    description: "Depósito inicial",
    createdAt: "2026-07-22T10:00:00.000Z",
    createdBy: { name: "Socio", email: "socio@test.com" },
  },
  {
    id: "a2",
    amount: 100,
    description: null,
    createdAt: "2026-07-23T14:00:00.000Z",
    createdBy: { name: "Socio", email: "socio@test.com" },
  },
]

const server = setupServer(
  http.get("/api/fund-additions", () => HttpResponse.json(mockAdditions)),
  http.get("/api/fund", () => HttpResponse.json({ fondo: 300 })),
  http.post("/api/fund-additions", async ({ request }) => {
    const body = await request.json() as { amount: number; description?: string }
    return HttpResponse.json({
      id: "new-a",
      amount: body.amount,
      description: body.description || null,
      createdAt: new Date().toISOString(),
      createdBy: { name: "Socio", email: "socio@test.com" },
    }, { status: 201 })
  }),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "1", name: "Socio", email: "socio@test.com", role: "SOCIO" } },
    status: "authenticated",
  }),
}))

vi.mock("@/components/app-header", () => ({
  default: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <header>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  ),
}))

import FondoPage from "../page"

describe("FondoPage", () => {
  it("renders page title and subtitle", async () => {
    render(<FondoPage />)
    await waitFor(() => {
      expect(screen.getByText("Gestión del Fondo")).toBeInTheDocument()
    })
    expect(screen.getByText("Fans Cashflow")).toBeInTheDocument()
  })

  it("shows loading state initially", () => {
    render(<FondoPage />)
    expect(screen.getByText("Cargando...")).toBeInTheDocument()
  })

  it("renders fund balance after loading", async () => {
    render(<FondoPage />)
    await waitFor(() => {
      expect(screen.getAllByText("300.00 €").length).toBeGreaterThanOrEqual(1)
    })
  })

  it("renders deposit form", async () => {
    render(<FondoPage />)
    await waitFor(() => {
      expect(screen.getByText("Depósito al Fondo")).toBeInTheDocument()
    })
    expect(screen.getByText("Monto")).toBeInTheDocument()
    expect(screen.getByText("Descripción")).toBeInTheDocument()
  })

  it("renders filter controls", async () => {
    render(<FondoPage />)
    await waitFor(() => {
      expect(screen.getByText("Historial de Depósitos")).toBeInTheDocument()
    })
    expect(screen.getByText("Desde")).toBeInTheDocument()
    expect(screen.getByText("Hasta")).toBeInTheDocument()
    expect(screen.getByText("Limpiar")).toBeInTheDocument()
  })

  it("renders deposit history after loading", async () => {
    render(<FondoPage />)
    await waitFor(() => {
      expect(screen.getByText(/200/)).toBeInTheDocument()
    })
    expect(screen.getByText("Depósito inicial")).toBeInTheDocument()
  })

  it("shows empty state when no additions", async () => {
    server.use(http.get("/api/fund-additions", () => HttpResponse.json([])))
    render(<FondoPage />)
    await waitFor(() => {
      expect(screen.getByText("No hay depósitos registrados.")).toBeInTheDocument()
    })
  })
})
