import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shift: { findUnique: vi.fn() },
    expense: { aggregate: vi.fn() },
    gastoCorriente: { aggregate: vi.fn() },
    cierreTurno: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
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
    fondoInicial: 100,
    date: new Date("2026-08-27T00:00:00.000Z"),
    createdAt: new Date("2026-08-27T08:00:00.000Z"),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", role: "EMPLEADO" } } as any)
    vi.mocked(prisma.shift.findUnique).mockResolvedValue(shift as any)
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { importe: 0 } } as any)
    vi.mocked(prisma.gastoCorriente.aggregate).mockResolvedValue({ _sum: { importe: 0 } } as any)
  })

  it("closes the shift without creating a ticket when explicitly requested", async () => {
    const updateShift = vi.fn().mockResolvedValue({ id: "shift-1", status: "CERRADO" })
    const upsertClosure = vi.fn()
    vi.mocked((prisma as any).$transaction).mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      shift: { update: updateShift },
      cierreTurno: { upsert: upsertClosure },
    }))

    const response = await PATCH(
      new Request("http://localhost/api/shifts/shift-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CERRADO", sinInformacion: true }),
      }) as unknown as NextRequest,
      context,
    )

    expect(response.status).toBe(200)
    expect(updateShift).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "shift-1" },
      data: expect.objectContaining({ status: "CERRADO", fondoFinal: 100 }),
    }))
    expect(upsertClosure).not.toHaveBeenCalled()
  })

  it("keeps requiring ticket information for a regular close", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/shifts/shift-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CERRADO" }),
      }) as unknown as NextRequest,
      context,
    )

    expect(response.status).toBe(400)
    expect(prisma.expense.aggregate).not.toHaveBeenCalled()
  })

  it("includes current expenses when calculating the final fund", async () => {
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { importe: 10 } } as any)
    vi.mocked(prisma.gastoCorriente.aggregate).mockResolvedValue({ _sum: { importe: 25 } } as any)
    const updateShift = vi.fn().mockResolvedValue({ id: "shift-1", status: "CERRADO" })
    vi.mocked((prisma as any).$transaction).mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      shift: { update: updateShift },
      cierreTurno: { upsert: vi.fn() },
    }))

    const response = await PATCH(
      new Request("http://localhost/api/shifts/shift-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CERRADO", sinInformacion: true }),
      }) as unknown as NextRequest,
      context,
    )

    expect(response.status).toBe(200)
    expect(updateShift).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ fondoFinal: 65 }),
    }))
  })

  it("does not allow an employee to overwrite the calculated opening fund", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/shifts/shift-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fondoInicial: 999 }),
      }) as unknown as NextRequest,
      context,
    )

    expect(response.status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
