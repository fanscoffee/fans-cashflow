import { describe, expect, it } from "vitest"
import { calculateFondo } from "../fondo"

describe("calculateFondo", () => {
  it("returns 0 when there is no last shift and no additions", () => {
    expect(calculateFondo(null, [])).toBe(0)
  })

  it("returns fondoFinal from last shift when there are no additions", () => {
    expect(calculateFondo({ fondoFinal: 500 }, [])).toBe(500)
  })

  it("sums additions when there is no last shift", () => {
    const additions = [{ amount: 100 }, { amount: 200 }]
    expect(calculateFondo(null, additions)).toBe(300)
  })

  it("adds last shift fondoFinal to sum of additions", () => {
    const additions = [{ amount: 100 }, { amount: 50.50 }]
    expect(calculateFondo({ fondoFinal: 500 }, additions)).toBe(650.5)
  })

  it("handles string amounts in additions", () => {
    const additions = [{ amount: "100" as unknown as number }, { amount: "200.50" as unknown as number }]
    expect(calculateFondo(null, additions)).toBe(300.5)
  })

  it("handles string fondoFinal in last shift", () => {
    expect(calculateFondo({ fondoFinal: "500" as unknown as number }, [])).toBe(500)
  })

  it("handles additions with zero amounts", () => {
    const additions = [{ amount: 0 }, { amount: 0 }]
    expect(calculateFondo({ fondoFinal: 100 }, additions)).toBe(100)
  })
})
