import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shift: { findUnique: vi.fn(), update: vi.fn() },
    expense: { aggregate: vi.fn() },
    gastoCorriente: { aggregate: vi.fn() },
  },
}))

import { recalculateShiftFondoFinal } from "../shift-fondo"
import { prisma } from "@/lib/prisma"

describe("recalculateShiftFondoFinal", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns null when the shift does not exist", async () => {
    vi.mocked(prisma.shift.findUnique).mockResolvedValue(null)

    await expect(recalculateShiftFondoFinal("shift-missing")).resolves.toBeNull()
    expect(prisma.shift.update).not.toHaveBeenCalled()
  })

  it("updates the final fund using legacy and current expenses", async () => {
    vi.mocked(prisma.shift.findUnique).mockResolvedValue({ fondoInicial: 500 } as any)
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { importe: 20 } } as any)
    vi.mocked(prisma.gastoCorriente.aggregate).mockResolvedValue({ _sum: { importe: 30 } } as any)
    vi.mocked(prisma.shift.update).mockResolvedValue({ id: "shift-1", fondoFinal: 450 } as any)

    await expect(recalculateShiftFondoFinal("shift-1")).resolves.toMatchObject({ id: "shift-1", fondoFinal: 450 })
    expect(prisma.gastoCorriente.aggregate).toHaveBeenCalledWith({
      _sum: { importe: true },
      where: { shiftId: "shift-1", estado: { not: "ANULADO" } },
    })
    expect(prisma.shift.update).toHaveBeenCalledWith({ where: { id: "shift-1" }, data: { fondoFinal: 450 } })
  })
})
