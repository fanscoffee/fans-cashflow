import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shift: { findUnique: vi.fn(), update: vi.fn() },
    expense: { aggregate: vi.fn() },
    currentExpense: { aggregate: vi.fn() },
  },
}))

import { recalculateShiftFundFinal } from "../shift-fund"
import { prisma } from "@/lib/prisma"

describe("recalculateShiftFundFinal", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns null when the shift does not exist", async () => {
    vi.mocked(prisma.shift.findUnique).mockResolvedValue(null)

    await expect(recalculateShiftFundFinal("shift-missing")).resolves.toBeNull()
    expect(prisma.shift.update).not.toHaveBeenCalled()
  })

  it("updates the final fund using legacy and current expenses", async () => {
    vi.mocked(prisma.shift.findUnique).mockResolvedValue({ openingFund: 500 } as any)
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { amount: 20 } } as any)
    vi.mocked(prisma.currentExpense.aggregate).mockResolvedValue({ _sum: { amount: 30 } } as any)
    vi.mocked(prisma.shift.update).mockResolvedValue({ id: "shift-1", closingFund: 450 } as any)

    await expect(recalculateShiftFundFinal("shift-1")).resolves.toMatchObject({ id: "shift-1", closingFund: 450 })
    expect(prisma.currentExpense.aggregate).toHaveBeenCalledWith({
      _sum: { amount: true },
      where: { shiftId: "shift-1", status: { not: "VOID" } },
    })
    expect(prisma.shift.update).toHaveBeenCalledWith({ where: { id: "shift-1" }, data: { closingFund: 450 } })
  })
})
