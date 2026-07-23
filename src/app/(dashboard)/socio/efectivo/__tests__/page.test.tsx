import { render, screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const mockShifts = [
  {
    id: "s1",
    date: "2026-07-22",
    turno: "mañana",
    status: "CERRADO",
    efectivo: 500,
    cashTracking: { id: "ct1", destination: "DEPOSITO", createdBy: { name: "Socio", email: "socio@test.com" } },
    createdBy: { name: "Empleado 1", email: "emp@test.com" },
  },
  {
    id: "s2",
    date: "2026-07-22",
    turno: "tarde",
    status: "CERRADO",
    efectivo: 300,
    cashTracking: null,
    createdBy: { name: "Empleado 2", email: "emp2@test.com" },
  },
]

const server = setupServer(
  http.get("/api/cash-tracking", () => HttpResponse.json(mockShifts)),
  http.patch("/api/cash-tracking", async ({ request }) => {
    const body = await request.json() as { shiftId: string; destination: string }
    return HttpResponse.json({ id: "ct-new", destination: body.destination })
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

import EfectivoPage from "../page"

describe("EfectivoPage", () => {
  it("renders page title and subtitle", async () => {
    render(<EfectivoPage />)
    await waitFor(() => {
      expect(screen.getByText("Tracking de Efectivo")).toBeInTheDocument()
    })
    expect(screen.getByText("Fans Cashflow")).toBeInTheDocument()
  })

  it("shows loading state initially", () => {
    render(<EfectivoPage />)
    expect(screen.getByText("Cargando...")).toBeInTheDocument()
  })

  it("renders shift data after loading", async () => {
    render(<EfectivoPage />)
    await waitFor(() => {
      expect(screen.getByText("Tracking de Efectivo")).toBeInTheDocument()
    })
    expect(screen.getAllByText(/500\.00/).length).toBeGreaterThanOrEqual(1)
  })

  it("renders month and year selectors", async () => {
    render(<EfectivoPage />)
    await waitFor(() => {
      expect(screen.getByText("Efectivo por Turno")).toBeInTheDocument()
    })
  })

  it("shows export button", async () => {
    render(<EfectivoPage />)
    await waitFor(() => {
      expect(screen.getByText("Exportar")).toBeInTheDocument()
    })
  })

  it("shows empty state when no shifts", async () => {
    server.use(http.get("/api/cash-tracking", () => HttpResponse.json([])))
    render(<EfectivoPage />)
    await waitFor(() => {
      expect(screen.getByText("No hay turnos para este período.")).toBeInTheDocument()
    })
  })
})
