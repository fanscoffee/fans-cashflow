import { describe, expect, it } from "vitest"
import { calculateFund, calculateFundFinal, calculateTotalExpenses } from "../fund"

describe("calculateFund", () => {
  it("returns 0 when there is no last shift and no additions", () => {
    expect(calculateFund(null, [])).toBe(0)
  })

  it("returns closingFund from last shift when there are no additions", () => {
    expect(calculateFund({ closingFund: 500 }, [])).toBe(500)
  })

  it("sums additions when there is no last shift", () => {
    const additions = [{ amount: 100 }, { amount: 200 }]
    expect(calculateFund(null, additions)).toBe(300)
  })

  it("adds last shift closingFund to sum of additions", () => {
    const additions = [{ amount: 100 }, { amount: 50.50 }]
    expect(calculateFund({ closingFund: 500 }, additions)).toBe(650.5)
  })

  it("handles string amounts in additions", () => {
    const additions = [{ amount: "100" as unknown as number }, { amount: "200.50" as unknown as number }]
    expect(calculateFund(null, additions)).toBe(300.5)
  })

  it("handles string closingFund in last shift", () => {
    expect(calculateFund({ closingFund: "500" as unknown as number }, [])).toBe(500)
  })

  it("handles additions with zero amounts", () => {
    const additions = [{ amount: 0 }, { amount: 0 }]
    expect(calculateFund({ closingFund: 100 }, additions)).toBe(100)
  })

  it("subtracts legacy and current shift expenses, ignoring annulled ones", () => {
    expect(calculateFundFinal(500, [{ amount: 20 }], [
      { amount: 30, status: "PENDIENTE_AUTORIZACION" },
      { amount: 100, status: "ANULADO" },
    ])).toBe(450)
  })

  it("includes current expenses in the displayed expense total", () => {
    expect(calculateTotalExpenses([{ amount: 20 }], [
      { amount: 30, status: "PENDIENTE_AUTORIZACION" },
      { amount: 100, status: "ANULADO" },
    ])).toBe(50)
  })
})
