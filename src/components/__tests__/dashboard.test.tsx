import { render, screen, fireEvent, waitFor } from "@testing-library/react"
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
  exportData: [{ fecha: "22/07", turno: "mañana", estado: "CERRADO", creadoPor: "Juan", fondoInicial: 200, efectivo: 500, caixa: 100, santander: 50, efectivoGasto: 50, fondoFinal: 300, totalGastos: 50, gastos: "Frutas: 50" }],
  exportExpenses: [{ fecha: "22/07", turno: "mañana", proveedor: "Frutas", importe: 50, creadoPor: "Juan" }],
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

  it("shows export buttons for ADMIN", async () => {
    render(<Dashboard />)
    await waitFor(() => {
      expect(screen.getByText("Exportar Turnos")).toBeInTheDocument()
    })
    expect(screen.getByText("Exportar Gastos")).toBeInTheDocument()
  })

  it("disables export buttons when no export data", async () => {
    server.use(http.get("/api/dashboard", () => HttpResponse.json({ ...mockDashboardData, exportData: [], exportExpenses: [] })))
    render(<Dashboard />)
    await waitFor(() => {
      expect(screen.getByText("Exportar Turnos")).toBeInTheDocument()
    })
    expect(screen.getByText("Exportar Turnos")).toBeDisabled()
    expect(screen.getByText("Exportar Gastos")).toBeDisabled()
  })

  it("renders summary with negative profit", async () => {
    server.use(http.get("/api/dashboard", () => HttpResponse.json({ ...mockDashboardData, resumen: { ...mockDashboardData.resumen, beneficioNeto: -500 } })))
    render(<Dashboard />)
    await waitFor(() => {
      expect(screen.getByText("-500.00 €")).toBeInTheDocument()
    })
  })

  it("allows month change", async () => {
    render(<Dashboard />)
    await waitFor(() => {
      expect(screen.getByText("Turnos")).toBeInTheDocument()
    })
    const monthSelect = screen.getByDisplayValue("Julio")
    fireEvent.change(monthSelect, { target: { value: "1" } })
    expect((monthSelect as HTMLSelectElement).value).toBe("1")
  })

  it("allows year change", async () => {
    render(<Dashboard />)
    await waitFor(() => {
      expect(screen.getByText("Turnos")).toBeInTheDocument()
    })
    const yearSelect = screen.getByDisplayValue(String(new Date().getFullYear()))
    fireEvent.change(yearSelect, { target: { value: "2024" } })
    expect((yearSelect as HTMLSelectElement).value).toBe("2024")
  })
})
