import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shift: { findUnique: vi.fn() },
    shiftClose: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { PATCH } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

describe("PATCH /api/shifts/[shiftId]", () => {
  const context = { params: Promise.resolve({ shiftId: "shift-1" }) }
  const shift = {
    id: "shift-1",
    createdById: "user-1",
    status: "ABIERTO",
    openingFund: 100,
    date: new Date("2026-08-27T00:00:00.000Z"),
    createdAt: new Date("2026-08-27T08:00:00.000Z"),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", role: "EMPLEADO" } } as any)
    vi.mocked(prisma.shift.findUnique).mockResolvedValue(shift as any)
  })

  function transactionMock({
    lockedShift = shift,
    legacyExpenses = 0,
    currentExpenses = 0,
    laterShift = null,
    additions = 0,
  }: {
    lockedShift?: typeof shift & { closedAt?: Date | null }
    legacyExpenses?: number
    currentExpenses?: number
    laterShift?: { id: string } | null
    additions?: number
  } = {}) {
    const updateShift = vi.fn().mockResolvedValue({ id: "shift-1", status: "CERRADO" })
    const upsertClosure = vi.fn()
    const aggregateAdditions = vi.fn().mockResolvedValue({ _sum: { amount: additions } })
    const executeRaw = vi.fn().mockResolvedValue(0)

    vi.mocked((prisma as any).$transaction).mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      $executeRaw: executeRaw,
      shift: {
        findUnique: vi.fn().mockResolvedValue(lockedShift),
        findFirst: vi.fn().mockResolvedValue(laterShift),
        update: updateShift,
      },
      expense: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: legacyExpenses } }) },
      currentExpense: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: currentExpenses } }) },
      fundAddition: { aggregate: aggregateAdditions },
      shiftClose: { upsert: upsertClosure },
      shiftOperationalReview: { upsert: vi.fn() },
    }))

    return { aggregateAdditions, executeRaw, updateShift, upsertClosure }
  }

  it("closes the shift without creating a ticket when explicitly requested", async () => {
    const { executeRaw, updateShift, upsertClosure } = transactionMock()

    const response = await PATCH(
      new Request("http://localhost/api/shifts/shift-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CERRADO",
          noInformation: true,
          operationalReview: { productionReviewed: true, wasteReviewed: true },
        }),
      }) as unknown as NextRequest,
      context,
    )

    expect(response.status).toBe(200)
    expect(updateShift).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "shift-1" },
      data: expect.objectContaining({ status: "CERRADO", closingFund: 100 }),
    }))
    expect(executeRaw).toHaveBeenCalledOnce()
    expect(upsertClosure).not.toHaveBeenCalled()
  })

  it("keeps requiring ticket information for a regular close", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/shifts/shift-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CERRADO",
          operationalReview: { productionReviewed: true, wasteReviewed: true },
        }),
      }) as unknown as NextRequest,
      context,
    )

    expect(response.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("includes current expenses when calculating the final fund", async () => {
    const { updateShift } = transactionMock({ legacyExpenses: 10, currentExpenses: 25 })

    const response = await PATCH(
      new Request("http://localhost/api/shifts/shift-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CERRADO",
          noInformation: true,
          operationalReview: { productionReviewed: true, wasteReviewed: true },
        }),
      }) as unknown as NextRequest,
      context,
    )

    expect(response.status).toBe(200)
    expect(updateShift).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ closingFund: 65 }),
    }))
  })

  it("accepts a ticket date when PostgreSQL DATE is represented at local midnight", async () => {
    const shiftForDate = {
      ...shift,
      date: new Date(2026, 9, 1),
      createdAt: new Date(2026, 9, 1, 17, 39),
    }
    vi.mocked(prisma.shift.findUnique).mockResolvedValue(shiftForDate as any)
    const { updateShift } = transactionMock({ lockedShift: shiftForDate })
    const response = await PATCH(
      new Request("http://localhost/api/shifts/shift-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CERRADO",
          close: {
            cashCloseNumber: "1692",
            openingDateTime: "2026-10-01T14:17",
            closingDateTime: "2026-10-01T21:16",
            grossSales: "778.55",
            refunds: "0.00",
            discounts: "0.00",
            netSales: "778.55",
            cashSales: "162.60",
            cardSales: "615.95",
            breadVat4Base: "1.25",
            breadVat4Amount: "0.05",
            vat10Base: "706.61",
            vat10Amount: "70.64",
            varianceNote: "Diferencia bancaria de 0,05",
            cash: "162.60",
            caixaBankAmount: "147.25",
            santanderAmount: "468.65",
          },
          operationalReview: { productionReviewed: true, wasteReviewed: true },
        }),
      }) as unknown as NextRequest,
      context,
    )

    expect(response.status).toBe(200)
    expect(updateShift).toHaveBeenCalled()
  })

  it("applies additions made after the latest shift was closed when reopening it", async () => {
    const closedShift = {
      ...shift,
      status: "CERRADO",
      openingFund: 100,
      closingFund: 100,
      closedAt: new Date("2026-08-27T12:00:00.000Z"),
    }
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)
    vi.mocked(prisma.shift.findUnique).mockResolvedValue(closedShift as any)
    const { aggregateAdditions, updateShift } = transactionMock({ lockedShift: closedShift, additions: 160 })

    const response = await PATCH(
      new Request("http://localhost/api/shifts/shift-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ABIERTO" }),
      }) as unknown as NextRequest,
      context,
    )

    expect(response.status).toBe(200)
    expect(aggregateAdditions).toHaveBeenCalledWith({
      _sum: { amount: true },
      where: { createdAt: { gt: closedShift.closedAt } },
    })
    expect(updateShift).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "ABIERTO",
        closedAt: null,
        openingFund: 260,
        closingFund: 260,
      }),
    }))
  })

  it("rejects reopening a historical shift so the fund chain cannot be corrupted", async () => {
    const closedShift = {
      ...shift,
      status: "CERRADO",
      openingFund: 100,
      closingFund: 100,
      closedAt: new Date("2026-08-27T12:00:00.000Z"),
    }
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)
    vi.mocked(prisma.shift.findUnique).mockResolvedValue(closedShift as any)
    const { aggregateAdditions, updateShift } = transactionMock({
      lockedShift: closedShift,
      laterShift: { id: "shift-2" },
      additions: 160,
    })

    const response = await PATCH(
      new Request("http://localhost/api/shifts/shift-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ABIERTO" }),
      }) as unknown as NextRequest,
      context,
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: "Solo se puede reabrir el último turno; hay turnos posteriores registrados",
    })
    expect(aggregateAdditions).not.toHaveBeenCalled()
    expect(updateShift).not.toHaveBeenCalled()
  })

  it("does not allow an employee to overwrite the calculated opening fund", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/shifts/shift-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingFund: 999 }),
      }) as unknown as NextRequest,
      context,
    )

    expect(response.status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("requires reviewing production and waste before closing", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/shifts/shift-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CERRADO", noInformation: true }),
      }) as unknown as NextRequest,
      context,
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Debes revisar la producción y las mermas antes de cerrar el turno" })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
