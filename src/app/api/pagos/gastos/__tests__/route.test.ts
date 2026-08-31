import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    asignacionPagoUsuario: { findFirst: vi.fn() },
    gastoCorriente: { findMany: vi.fn() },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { GET, POST } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const request = new Request("http://localhost/api/pagos/gastos") as unknown as NextRequest

const postRequest = new Request("http://localhost/api/pagos/gastos", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
}) as unknown as NextRequest

describe("GET /api/pagos/gastos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("is restricted to ADMIN and SOCIO", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)

    const response = await GET(request)

    expect(response.status).toBe(403)
    expect(prisma.gastoCorriente.findMany).not.toHaveBeenCalled()
  })

  it("returns the trace including its source shift for SOCIO", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)
    vi.mocked(prisma.gastoCorriente.findMany).mockResolvedValue([{
      id: "expense-1",
      shift: { id: "shift-1", date: new Date("2026-08-31"), turno: "mañana" },
    }] as any)

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.gastoCorriente.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { shiftId: { not: null }, estado: { not: "ANULADO" } },
      include: expect.objectContaining({
        shift: { select: { id: true, date: true, turno: true } },
      }),
      take: 500,
    }))
    await expect(response.json()).resolves.toMatchObject([{ id: "expense-1", shift: { id: "shift-1" } }])
  })

  it("rejects direct expense creation outside an open shift", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)

    const response = await POST(postRequest)

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toMatchObject({ error: "Los gastos corrientes deben registrarse desde un turno abierto" })
  })
})
