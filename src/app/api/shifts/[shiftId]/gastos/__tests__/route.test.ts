import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shift: { findUnique: vi.fn(), update: vi.fn() },
    expense: { aggregate: vi.fn() },
    categoriaGasto: { findMany: vi.fn(), findUnique: vi.fn() },
    acreedor: { findMany: vi.fn(), findUnique: vi.fn() },
    gastoCorriente: { aggregate: vi.fn(), create: vi.fn() },
    eventoAuditoria: { create: vi.fn() },
    asignacionPagoUsuario: { findFirst: vi.fn() },
    cierreMensual: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { GET, POST } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const context = { params: Promise.resolve({ shiftId: "shift-1" }) }

function request(body?: Record<string, unknown>) {
  return new Request("http://localhost/api/shifts/shift-1/gastos", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest
}

describe("/api/shifts/[shiftId]/gastos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)
    vi.mocked(prisma.shift.findUnique).mockResolvedValue({ id: "shift-1", status: "ABIERTO", createdById: "employee-1", fondoInicial: 500 } as any)
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { importe: 0 } } as any)
    vi.mocked(prisma.gastoCorriente.aggregate).mockResolvedValue({ _sum: { importe: 0 } } as any)
    vi.mocked(prisma.shift.update).mockResolvedValue({ id: "shift-1", fondoFinal: 500 } as any)
    vi.mocked(prisma.asignacionPagoUsuario.findFirst).mockResolvedValue({ id: "assignment-1" } as any)
  })

  it("allows the employee who owns an open shift to create a current expense", async () => {
    vi.mocked(prisma.categoriaGasto.findUnique).mockResolvedValue({ id: "cat-personal", codigo: "PER", activo: true } as any)
    vi.mocked(prisma.gastoCorriente.create).mockResolvedValue({ id: "expense-1" } as any)
    vi.mocked(prisma.asignacionPagoUsuario.findFirst).mockResolvedValue(null)

    const response = await POST(request({
      categoriaId: "cat-personal",
      concepto: "Horas extras del empleado",
      fechaDevengo: "2026-08-31",
      importe: 125.5,
    }), context)

    expect(response.status).toBe(201)
    expect(prisma.gastoCorriente.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entidad: "CAFETERIA",
        shiftId: "shift-1",
        justificante: "SIN_JUSTIFICANTE",
        solicitanteId: "employee-1",
      }),
    })
  })

  it("does not let an employee register an expense in another employee's shift", async () => {
    vi.mocked(prisma.shift.findUnique).mockResolvedValue({ id: "shift-1", status: "ABIERTO", createdById: "employee-2" } as any)

    const response = await POST(request({
      categoriaId: "cat-personal",
      concepto: "Horas extras del empleado",
      fechaDevengo: "2026-08-31",
      importe: 125.5,
    }), context)

    expect(response.status).toBe(404)
    expect(prisma.gastoCorriente.create).not.toHaveBeenCalled()
  })

  it("rejects creating an expense when the shift is closed", async () => {
    vi.mocked(prisma.shift.findUnique).mockResolvedValue({ id: "shift-1", status: "CERRADO", createdById: "employee-1" } as any)

    const response = await POST(request({
      categoriaId: "cat-personal",
      concepto: "Horas extras del empleado",
      fechaDevengo: "2026-08-31",
      importe: 125.5,
    }), context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: "SHIFT_NOT_OPEN" })
    expect(prisma.gastoCorriente.create).not.toHaveBeenCalled()
  })

  it("returns the category and creditor options for an open shift", async () => {
    vi.mocked(prisma.categoriaGasto.findMany).mockResolvedValue([{ id: "cat-personal", codigo: "PER", nombre: "Personal" }] as any)
    vi.mocked(prisma.acreedor.findMany).mockResolvedValue([])

    const response = await GET(request(), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      entidad: "CAFETERIA",
      categorias: [{ codigo: "PER" }],
      acreedores: [],
    })
  })
})
