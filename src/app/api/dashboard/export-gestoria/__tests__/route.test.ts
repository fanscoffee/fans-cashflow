import { describe, expect, it, vi, beforeEach } from "vitest"
import ExcelJS from "exceljs"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: { findMany: vi.fn() },
    currentExpense: { findMany: vi.fn() },
    expense: { findMany: vi.fn() },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { GET } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

function request(url: string) {
  return new Request(url) as unknown as NextRequest
}

describe("Dashboard API /api/dashboard/export-gestoria", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([])
    vi.mocked(prisma.currentExpense.findMany).mockResolvedValue([])
    vi.mocked(prisma.expense.findMany).mockResolvedValue([])
  })

  it("requires authentication and an allowed role", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    expect((await GET(request("http://localhost/api/dashboard/export-gestoria"))).status).toBe(401)

    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "EMPLEADO" } } as any)
    expect((await GET(request("http://localhost/api/dashboard/export-gestoria"))).status).toBe(403)
  })

  it("rejects invalid periods", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "ADMIN" } } as any)
    const response = await GET(request("http://localhost/api/dashboard/export-gestoria?month=13&year=2026"))
    expect(response.status).toBe(400)
    expect(prisma.invoice.findMany).not.toHaveBeenCalled()
  })

  it("returns an xlsx workbook for the requested period", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "SOCIO" } } as any)
    const response = await GET(request("http://localhost/api/dashboard/export-gestoria?month=7&year=2026"))

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("spreadsheetml.sheet")
    expect(response.headers.get("content-disposition")).toContain("fans-cashflow-gestoria-2026-07.xlsx")

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await response.arrayBuffer())
    expect(workbook.getWorksheet("Gastos y Compras Fans")).toBeDefined()
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        issueDate: {
          gte: new Date("2026-07-01T00:00:00.000Z"),
          lt: new Date("2026-08-01T00:00:00.000Z"),
        },
      }),
    }))
  })
})
