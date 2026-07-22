import { render, screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import Dashboard from "../dashboard"

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "1", email: "test@test.com", name: "Test User", role: "ADMIN" } },
    status: "authenticated",
  }),
}))

const mockDashboardData = {
  resumen: { totalTurnos: 10, totalIngresos: 5000, totalGastos: 2000, beneficioNeto: 3000 },
  dailyData: [{ dia: "22/07", ingresos: 500, gastos: 200, mañana: 300, tarde: 200 }],
  turnoData: [{ name: "Mañana", value: 3000 }],
  expenseData: [{ proveedor: "Proveedor A", total: 500 }],
  exportData: [],
  exportExpenses: [],
}

const server = setupServer(
  http.get("/api/dashboard", () => HttpResponse.json(mockDashboardData)),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("Dashboard", () => {
  it("shows loading state initially", () => {
    render(<Dashboard />)
    expect(screen.getByText("Cargando dashboard...")).toBeInTheDocument()
  })

  it("renders summary cards after loading", async () => {
    render(<Dashboard />)
    await waitFor(() => {
      expect(screen.getByText("Turnos")).toBeInTheDocument()
    })
    expect(screen.getByText("10")).toBeInTheDocument()
    expect(screen.getByText("5000.00 €")).toBeInTheDocument()
  })

  it("shows 'No hay datos disponibles' on empty response", async () => {
    server.use(http.get("/api/dashboard", () => HttpResponse.json(null)))
    render(<Dashboard />)
    await waitFor(() => {
      expect(screen.getByText("No hay datos disponibles")).toBeInTheDocument()
    })
  })

  it("renders month and year selects", async () => {
    render(<Dashboard />)
    await waitFor(() => {
      expect(screen.getByText("Turnos")).toBeInTheDocument()
    })
    const monthSelect = screen.getByDisplayValue("Julio")
    expect(monthSelect).toBeInTheDocument()
  })

  it("renders expense table when expenseData exists", async () => {
    render(<Dashboard />)
    await waitFor(() => {
      expect(screen.getByText("Proveedor A")).toBeInTheDocument()
    })
    expect(screen.getByText("500.00 €")).toBeInTheDocument()
  })
})
