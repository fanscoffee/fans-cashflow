import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shift: { findUnique: vi.fn(), update: vi.fn() },
    expense: { aggregate: vi.fn() },
    expenseCategory: { findMany: vi.fn(), findUnique: vi.fn() },
    creditor: { findMany: vi.fn(), findUnique: vi.fn() },
    currentExpense: { aggregate: vi.fn(), create: vi.fn() },
    auditEvent: { create: vi.fn() },
    userPaymentAssignment: { findFirst: vi.fn() },
    monthlyClose: { findUnique: vi.fn().mockResolvedValue(null) },
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
    vi.mocked(prisma.shift.findUnique).mockResolvedValue({ id: "shift-1", status: "ABIERTO", createdById: "employee-1", openingFund: 500 } as any)
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { amount: 0 } } as any)
    vi.mocked(prisma.currentExpense.aggregate).mockResolvedValue({ _sum: { amount: 0 } } as any)
    vi.mocked(prisma.shift.update).mockResolvedValue({ id: "shift-1", closingFund: 500 } as any)
    vi.mocked(prisma.userPaymentAssignment.findFirst).mockResolvedValue({ id: "assignment-1" } as any)
  })

  it("allows the employee who owns an open shift to create a current expense", async () => {
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue({ id: "cat-personal", code: "PER", active: true } as any)
    vi.mocked(prisma.currentExpense.create).mockResolvedValue({ id: "expense-1" } as any)
    vi.mocked(prisma.userPaymentAssignment.findFirst).mockResolvedValue(null)

    const response = await POST(request({
      categoryId: "cat-personal",
      concept: "Horas extras del empleado",
      accrualDate: "2026-08-31",
      amount: 125.5,
    }), context)

    expect(response.status).toBe(201)
    expect(prisma.currentExpense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entity: "COFFEE_SHOP",
        shiftId: "shift-1",
        receipt: "NO_RECEIPT",
        requesterId: "employee-1",
      }),
    })
  })

  it("does not let an employee register an expense in another employee's shift", async () => {
    vi.mocked(prisma.shift.findUnique).mockResolvedValue({ id: "shift-1", status: "ABIERTO", createdById: "employee-2" } as any)

    const response = await POST(request({
      categoryId: "cat-personal",
      concept: "Horas extras del empleado",
      accrualDate: "2026-08-31",
      amount: 125.5,
    }), context)

    expect(response.status).toBe(404)
    expect(prisma.currentExpense.create).not.toHaveBeenCalled()
  })

  it("rejects creating an expense when the shift is closed", async () => {
    vi.mocked(prisma.shift.findUnique).mockResolvedValue({ id: "shift-1", status: "CERRADO", createdById: "employee-1" } as any)

    const response = await POST(request({
      categoryId: "cat-personal",
      concept: "Horas extras del empleado",
      accrualDate: "2026-08-31",
      amount: 125.5,
    }), context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: "SHIFT_NOT_OPEN" })
    expect(prisma.currentExpense.create).not.toHaveBeenCalled()
  })

  it("returns the category and creditor options for an open shift", async () => {
    vi.mocked(prisma.expenseCategory.findMany).mockResolvedValue([{ id: "cat-personal", code: "PER", name: "Personal" }] as any)
    vi.mocked(prisma.creditor.findMany).mockResolvedValue([])

    const response = await GET(request(), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      entity: "COFFEE_SHOP",
      categories: [{ code: "PER" }],
      creditors: [],
    })
  })
})
