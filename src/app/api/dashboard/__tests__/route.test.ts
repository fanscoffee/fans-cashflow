import { describe, expect, it, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shift: {
      findMany: vi.fn(),
    },
    expense: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn() as unknown as () => Promise<null>,
}))

import { GET } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

function mockRequest(url: string) {
  return new Request(url) as unknown as NextRequest
}

describe("Dashboard API /api/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    const res = await GET(mockRequest("http://localhost/api/dashboard"))
    expect(res.status).toBe(401)
  })

  it("returns dashboard data with month/year params", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "1", role: "ADMIN" },
    } as any)
    vi.mocked(prisma.shift.findMany).mockResolvedValue([
      {
        id: "s1",
        date: new Date("2026-07-01"),
        shift: "mañana",
        status: "CERRADO",
        cash: 100,
        caixaBankAmount: 50,
        santanderAmount: 30,
        cashExpense: 10,
        openingFund: 200,
        closingFund: 280,
        createdBy: { name: "Admin" },
        expenses: [
          { supplier: "Frutas", amount: 25 },
          { supplier: "Limon", amount: 15 },
        ],
      },
      {
        id: "s2",
        date: new Date("2026-07-01"),
        shift: "tarde",
        status: "CERRADO",
        cash: 80,
        caixaBankAmount: 40,
        santanderAmount: 20,
        cashExpense: 5,
        openingFund: 280,
        closingFund: 320,
        createdBy: { name: "Admin" },
        expenses: [],
      },
    ] as any)

    const res = await GET(mockRequest("http://localhost/api/dashboard?month=7&year=2026"))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.summary).toBeDefined()
    expect(data.summary.totalShifts).toBe(2)
    expect(data.dailyData).toBeDefined()
    expect(data.shiftData).toHaveLength(2)
    expect(data.expenseData).toHaveLength(2)
    expect(data.exportData).toHaveLength(2)
    expect(data.exportExpenses).toHaveLength(2)
    expect(data.exportExpenses[0]).toMatchObject({ concepto: "" })
  })

  it("includes the concept of current expenses in the export", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "1", role: "ADMIN" },
    } as any)
    vi.mocked(prisma.shift.findMany).mockResolvedValue([
      {
        date: new Date("2026-07-02"),
        shift: "mañana",
        status: "CERRADO",
        cash: 0,
        caixaBankAmount: 0,
        santanderAmount: 0,
        cashExpense: 0,
        openingFund: 0,
        closingFund: 0,
        createdBy: { name: "Empleado" },
        expenses: [],
        currentExpenses: [{ concept: "Compra de harina", amount: 25, category: { name: "Suministros" } }],
      },
    ] as any)

    const res = await GET(mockRequest("http://localhost/api/dashboard?month=7&year=2026"))
    const data = await res.json()

    expect(data.exportExpenses).toMatchObject([{
      concepto: "Compra de harina",
      proveedor: "Gasto corriente · Suministros",
      importe: 25,
    }])
  })

  it("uses current month/year when no params", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "1", role: "ADMIN" },
    } as any)
    vi.mocked(prisma.shift.findMany).mockResolvedValue([])

    const res = await GET(mockRequest("http://localhost/api/dashboard"))
    expect(res.status).toBe(200)
    expect(prisma.shift.findMany).toHaveBeenCalled()
  })

  it("handles shifts with no expenses", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "1", role: "ADMIN" },
    } as any)
    vi.mocked(prisma.shift.findMany).mockResolvedValue([
      {
        id: "s1",
        date: new Date("2026-07-01"),
        shift: "mañana",
        status: "ABIERTO",
        cash: 0,
        caixaBankAmount: 0,
        santanderAmount: 0,
        cashExpense: 0,
        openingFund: 0,
        closingFund: 0,
        createdBy: null,
        expenses: [],
      },
    ] as any)

    const res = await GET(mockRequest("http://localhost/api/dashboard?month=7&year=2026"))
    const data = await res.json()
    expect(data.summary.totalRevenue).toBe(0)
    expect(data.summary.totalExpenses).toBe(0)
    expect(data.summary.netProfit).toBe(0)
  })
})
