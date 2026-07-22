import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
    caixa: 200,
    santander: 300,
    fondoInicial: 100,
    fondoFinal: 80,
    expenses: [{ id: "e1", proveedor: "Proveedor A", importe: 20 }],
    createdAt: "2026-07-22T08:00:00.000Z",
    createdBy: { name: "Empleado 1", email: "emp@test.com" },
  },
  {
    id: "s2",
    date: "2026-07-22",
    turno: "tarde",
    status: "CERRADO",
    efectivo: 400,
    caixa: 150,
    santander: 250,
    fondoInicial: 80,
    fondoFinal: 60,
    expenses: [],
    createdAt: "2026-07-22T14:00:00.000Z",
    createdBy: { name: "Empleado 2", email: "emp2@test.com" },
  },
]

const server = setupServer(
  http.get("/api/shifts", () => HttpResponse.json(mockShifts)),
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

import TurnosPage from "../page"

describe("TurnosPage", () => {
  it("renders page title and subtitle", async () => {
    render(<TurnosPage />)
    expect(screen.getByText("Fans Cashflow")).toBeInTheDocument()
    expect(screen.getAllByText("Historial de Turnos").length).toBeGreaterThanOrEqual(1)
  })

  it("shows loading state initially", () => {
    render(<TurnosPage />)
    expect(screen.getByText("Cargando...")).toBeInTheDocument()
  })

  it("renders shifts after loading", async () => {
    render(<TurnosPage />)
    await waitFor(() => {
      expect(screen.getAllByText(/Empleado 1/).length).toBeGreaterThanOrEqual(1)
    })
  })

  it("shows filter controls", async () => {
    render(<TurnosPage />)
    await waitFor(() => {
      expect(screen.getByText("Desde")).toBeInTheDocument()
    })
    expect(screen.getByText("Hasta")).toBeInTheDocument()
    expect(screen.getByText("Turno")).toBeInTheDocument()
    expect(screen.getByText("Estado")).toBeInTheDocument()
    expect(screen.getByText("Persona")).toBeInTheDocument()
  })

  it("shows empty state when no shifts", async () => {
    server.use(http.get("/api/shifts", () => HttpResponse.json([])))
    render(<TurnosPage />)
    await waitFor(() => {
      expect(screen.getByText("No hay turnos registrados.")).toBeInTheDocument()
    })
  })

  it("renders day groups with facturacion totals", async () => {
    render(<TurnosPage />)
    await waitFor(() => {
      expect(screen.getAllByText(/Empleado 1/).length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText(/€/).length).toBeGreaterThanOrEqual(1)
  })
})
