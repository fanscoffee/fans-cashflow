import { describe, expect, it } from "vitest"
import { calculateProductionConsumptions, roundOperationalQuantity } from "@/lib/production-calculations"

describe("production calculations", () => {
  it("calculates theoretical consumption per produced unit", () => {
    expect(calculateProductionConsumptions(10, 5, [
      { componentProductId: "coffee", quantityPerUnit: 0.018 },
      { componentProductId: "milk", quantityPerUnit: 0.2 },
    ])).toEqual([
      expect.objectContaining({ componentProductId: "coffee", theoreticalQuantity: 0.18, actualQuantity: 0.18, hasDeviation: false }),
      expect.objectContaining({ componentProductId: "milk", theoreticalQuantity: 2, actualQuantity: 2, hasDeviation: false }),
    ])
  })

  it("flags only deviations above the configured tolerance", () => {
    const result = calculateProductionConsumptions(
      10,
      5,
      [{ componentProductId: "coffee", quantityPerUnit: 0.02 }],
      [{ componentProductId: "coffee", quantity: 0.22 }],
    )
    expect(result[0]).toMatchObject({
      theoreticalQuantity: 0.2,
      actualQuantity: 0.22,
      hasDeviation: true,
      exceedsTolerance: true,
    })
  })

  it("rejects duplicate and unknown actual components", () => {
    expect(() => calculateProductionConsumptions(1, 5, [{ componentProductId: "a", quantityPerUnit: 1 }], [
      { componentProductId: "a", quantity: 1 },
      { componentProductId: "a", quantity: 1 },
    ])).toThrow("No puedes repetir un componente")

    expect(() => calculateProductionConsumptions(1, 5, [{ componentProductId: "a", quantityPerUnit: 1 }], [
      { componentProductId: "b", quantity: 1 },
    ])).toThrow("no pertenece a la receta")
  })

  it("rounds operational quantities to six decimals", () => {
    expect(roundOperationalQuantity(1 / 3)).toBe(0.333333)
  })
})
