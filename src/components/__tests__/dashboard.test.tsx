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
  summary: { totalShifts: 10, totalRevenue: 5000, totalExpenses: 2000, netProfit: 3000 },
  dailyData: [{ day: "22/07", revenue: 500, expenses: 200, morning: 300, afternoon: 200 }],
  shiftData: [{ name: "Mañana", value: 3000 }],
  expenseData: [{ supplier: "Proveedor A", total: 500 }],
  exportData: [{ date: "22/07", shift: "mañana", status: "CERRADO", createdBy: "Juan", openingFund: 200, cash: 500, caixaBankAmount: 100, santanderAmount: 50, cashExpense: 50, closingFund: 300, totalExpenses: 50, expenses: "Frutas: 50" }],
  exportExpenses: [{ fecha: "22/07", turno: "mañana", concepto: "Compra de fruta", proveedor: "Frutas", importe: 50, creadoPor: "Juan" }],
}

const mockSalesInventoryData = {
  state: "OK",
  counts: {
    current: { id: "actual", countedAt: "2026-07-31T00:00:00.000Z" },
    previous: { id: "anterior", countedAt: "2026-06-30T00:00:00.000Z" },
  },
  summary: {
    theoreticalSales: 1200,
    actualSales: 1300,
    variance: 100,
    variancePct: 8.33,
    shiftsWithClose: 5,
    shiftsWithoutClose: 0,
    productsValued: 3,
    pendingProducts: 0,
    inventoryAdjustments: 0,
  },
  warnings: [],
}

const server = setupServer(
  http.get("/api/dashboard", () => HttpResponse.json(mockDashboardData)),
  http.get("/api/dashboard/venta-inventario", () => HttpResponse.json(mockSalesInventoryData)),
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

  it("shows the no-data message on an empty response", async () => {
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

  it("exports the selected period for accounting", async () => {
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
    server.use(http.get("/api/dashboard", () => HttpResponse.json({ ...mockDashboardData, summary: { ...mockDashboardData.summary, netProfit: -500 } })))
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
