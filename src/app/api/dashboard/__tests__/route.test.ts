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
        turno: "mañana",
        status: "CERRADO",
        efectivo: 100,
        caixa: 50,
        santander: 30,
        efectivoGasto: 10,
        fondoInicial: 200,
        fondoFinal: 280,
        createdBy: { name: "Admin" },
        expenses: [
          { proveedor: "Frutas", importe: 25 },
          { proveedor: "Limon", importe: 15 },
        ],
      },
      {
        id: "s2",
        date: new Date("2026-07-01"),
        turno: "tarde",
        status: "CERRADO",
        efectivo: 80,
        caixa: 40,
        santander: 20,
        efectivoGasto: 5,
        fondoInicial: 280,
        fondoFinal: 320,
        createdBy: { name: "Admin" },
        expenses: [],
      },
    ] as any)

    const res = await GET(mockRequest("http://localhost/api/dashboard?month=7&year=2026"))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.resumen).toBeDefined()
    expect(data.resumen.totalTurnos).toBe(2)
    expect(data.dailyData).toBeDefined()
    expect(data.turnoData).toHaveLength(2)
    expect(data.expenseData).toHaveLength(2)
    expect(data.exportData).toHaveLength(2)
    expect(data.exportExpenses).toHaveLength(2)
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
        turno: "mañana",
        status: "ABIERTO",
        efectivo: 0,
        caixa: 0,
        santander: 0,
        efectivoGasto: 0,
        fondoInicial: 0,
        fondoFinal: 0,
        createdBy: null,
        expenses: [],
      },
    ] as any)

    const res = await GET(mockRequest("http://localhost/api/dashboard?month=7&year=2026"))
    const data = await res.json()
    expect(data.resumen.totalIngresos).toBe(0)
    expect(data.resumen.totalGastos).toBe(0)
    expect(data.resumen.beneficioNeto).toBe(0)
  })
})
