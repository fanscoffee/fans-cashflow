import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import Dashboard from "../dashboard"
import { MONTH_NAMES } from "@/lib/constants"
import { downloadBlob, downloadCSV } from "@/lib/csv"

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "1", email: "test@test.com", name: "Test User", role: "ADMIN" } },
    status: "authenticated",
  }),
}))

vi.mock("@/lib/csv", () => ({
  downloadBlob: vi.fn(),
  downloadCSV: vi.fn(),
}))

const mockDashboardData = {
  resumen: { totalTurnos: 10, totalIngresos: 5000, totalGastos: 2000, beneficioNeto: 3000 },
  dailyData: [{ dia: "22/07", ingresos: 500, gastos: 200, mañana: 300, tarde: 200 }],
  turnoData: [{ name: "Mañana", value: 3000 }],
  expenseData: [{ proveedor: "Proveedor A", total: 500 }],
  exportData: [{ fecha: "22/07", turno: "mañana", estado: "CERRADO", creadoPor: "Juan", fondoInicial: 200, efectivo: 500, caixa: 100, santander: 50, efectivoGasto: 50, fondoFinal: 300, totalGastos: 50, gastos: "Frutas: 50" }],
  exportExpenses: [{ fecha: "22/07", turno: "mañana", concepto: "Compra de fruta", proveedor: "Frutas", importe: 50, creadoPor: "Juan" }],
}

const mockVentaInventarioData = {
  estado: "OK",
  conteos: {
    actual: { id: "actual", fechaConteo: "2026-07-31T00:00:00.000Z" },
    anterior: { id: "anterior", fechaConteo: "2026-06-30T00:00:00.000Z" },
  },
  resumen: {
    ventaTeorica: 1200,
    ventaReal: 1300,
    diferencia: 100,
    diferenciaPct: 8.33,
    turnosConCierre: 5,
    turnosSinCierre: 0,
    productosValorizados: 3,
    productosPendientes: 0,
    ajustesInventario: 0,
  },
  advertencias: [],
}

const server = setupServer(
  http.get("/api/dashboard", () => HttpResponse.json(mockDashboardData)),
  http.get("/api/dashboard/venta-inventario", () => HttpResponse.json(mockVentaInventarioData)),
  http.get("/api/dashboard/export-gestoria", () => new HttpResponse(new Uint8Array([80, 75, 3, 4]), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } })),
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
    const currentMonth = MONTH_NAMES[new Date().getMonth()]
    const currentYear = String(new Date().getFullYear())
    expect(screen.getByDisplayValue(currentMonth)).toBeInTheDocument()
    expect(screen.getByDisplayValue(currentYear)).toBeInTheDocument()
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

  it("includes the expense concept when exporting expenses", async () => {
    vi.mocked(downloadCSV).mockClear()
    render(<Dashboard />)
    await waitFor(() => {
      expect(screen.getByText("Exportar Gastos")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("Exportar Gastos"))

    expect(downloadCSV).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ concepto: "Compra de fruta" })]),
      expect.stringMatching(/^fans-cashflow-gastos-\d{4}-\d{2}\.csv$/),
    )
  })

  it("exports the selected period for the gestoría", async () => {
    vi.mocked(downloadBlob).mockClear()
    render(<Dashboard />)
    await waitFor(() => {
      expect(screen.getByText("Exportar Gestoria")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("Exportar Gestoria"))

    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalled()
    })
    const filename = vi.mocked(downloadBlob).mock.calls[0]?.[1]
    expect(filename).toBe(`fans-cashflow-gestoria-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}.xlsx`)
  })

  it("disables export buttons when no export data", async () => {
    server.use(http.get("/api/dashboard", () => HttpResponse.json({ ...mockDashboardData, exportData: [], exportExpenses: [] })))
    render(<Dashboard />)
    await waitFor(() => {
      expect(screen.getByText("Exportar Turnos")).toBeInTheDocument()
    })
    expect(screen.getByText("Exportar Turnos")).toBeDisabled()
    expect(screen.getByText("Exportar Gastos")).toBeDisabled()
    expect(screen.getByText("Exportar Gestoria")).not.toBeDisabled()
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
    const currentMonthIndex = new Date().getMonth()
    const monthSelect = screen.getByDisplayValue(MONTH_NAMES[currentMonthIndex])
    const target = String(currentMonthIndex === 0 ? 2 : 1)
    fireEvent.change(monthSelect, { target: { value: target } })
    expect((monthSelect as HTMLSelectElement).value).toBe(target)
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
