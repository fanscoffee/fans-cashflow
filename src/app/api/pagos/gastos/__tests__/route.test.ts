import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userPaymentAssignment: { findFirst: vi.fn() },
    currentExpense: { findMany: vi.fn() },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/payments", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments")>("@/lib/payments")
  return { ...actual, createExpense: vi.fn(), requirePaymentFunction: vi.fn() }
})

import { GET, POST } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { createExpense, requirePaymentFunction } from "@/lib/payments"

const request = new Request("http://localhost/api/pagos/gastos") as unknown as NextRequest

describe("GET /api/pagos/gastos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePaymentFunction).mockResolvedValue(undefined)
  })

  it("is restricted to ADMIN and PARTNER", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)

    const response = await GET(request)

    expect(response.status).toBe(403)
    expect(prisma.currentExpense.findMany).not.toHaveBeenCalled()
  })

  it("returns the trace including its source shift for PARTNER", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)
    vi.mocked(prisma.currentExpense.findMany).mockResolvedValue([{
      id: "expense-1",
      shift: { id: "shift-1", date: new Date("2026-08-31"), shift: "mañana" },
    }] as any)

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.currentExpense.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { not: "VOID" } },
      include: expect.objectContaining({
        shift: { select: { id: true, date: true, shift: true } },
      }),
      take: 500,
    }))
    await expect(response.json()).resolves.toMatchObject([{ id: "expense-1", shift: { id: "shift-1" } }])
  })

  it("creates an extra expense without a shift or invoice", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)
    vi.mocked(createExpense).mockResolvedValue({ id: "expense-extra-1", shiftId: null, status: "PENDING_AUTHORIZATION" } as any)

    const response = await POST(new Request("http://localhost/api/pagos/gastos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "BAKERY",
        categoryId: "category-1",
        concept: "Compra urgente de material",
        accrualDate: "2026-11-12",
        amount: 24.5,
        receipt: "NO_RECEIPT",
      }),
    }) as unknown as NextRequest)

    expect(response.status).toBe(201)
    expect(requirePaymentFunction).toHaveBeenCalledWith("partner-1", "REQUEST", "BAKERY", "SOCIO")
    expect(createExpense).toHaveBeenCalledWith({ id: "partner-1", role: "SOCIO" }, expect.objectContaining({ entity: "BAKERY", receipt: "NO_RECEIPT", concept: "Compra urgente de material" }))
    await expect(response.json()).resolves.toMatchObject({ id: "expense-extra-1", shiftId: null })
  })
})
