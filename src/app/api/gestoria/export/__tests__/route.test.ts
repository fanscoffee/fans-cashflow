import { beforeEach, describe, expect, it, vi } from "vitest"
import ExcelJS from "exceljs"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    facturaGestoria: { findMany: vi.fn() },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { GET } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const request = (url: string) => new Request(url) as unknown as NextRequest

describe("GET /api/gestoria/export", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.facturaGestoria.findMany).mockResolvedValue([] as any)
  })

  it("requires an allowed role", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)
    expect((await GET(request("http://localhost/api/gestoria/export"))).status).toBe(403)
  })

  it("exports only captures from requested month using the shared layout", async () => {
    const response = await GET(request("http://localhost/api/gestoria/export?month=7&year=2026"))
    expect(response.status).toBe(200)
    expect(response.headers.get("content-disposition")).toContain("fans-cashflow-gestoria-capturadas-2026-07.xlsx")
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await response.arrayBuffer())
    expect(workbook.getWorksheet("Gastos y Compras Fans")).toBeDefined()
    expect(prisma.facturaGestoria.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { fecha: { gte: new Date("2026-07-01T00:00:00.000Z"), lt: new Date("2026-08-01T00:00:00.000Z") } } }))
  })
})
