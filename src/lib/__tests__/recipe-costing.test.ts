import { describe, expect, it } from "vitest"
import { calculateRecipeUnitCost } from "@/lib/recipe-costing"

describe("calculateRecipeUnitCost", () => {
  it("sums component quantities using their base-unit costs", () => {
    expect(calculateRecipeUnitCost([
      {
        componentProductId: "croissant",
        quantityPerUnit: 1,
        componentProduct: { code: "PT-BOL-001", baseUnitCost: 12, purchaseToBaseFactor: 12 },
      },
      {
        componentProductId: "ham",
        quantityPerUnit: 0.04,
        componentProduct: { code: "MP-CAR-001", baseUnitCost: 20, purchaseToBaseFactor: null },
      },
      {
        componentProductId: "cheese",
        quantityPerUnit: 0.03,
        componentProduct: { code: "MP-LAC-001", baseUnitCost: 10, purchaseToBaseFactor: null },
      },
    ])).toEqual({
      calculatedUnitCost: 2.1,
      snapshots: [
        { componentProductId: "croissant", unitCostSnapshot: 1, lineCost: 1 },
        { componentProductId: "ham", unitCostSnapshot: 20, lineCost: 0.8 },
        { componentProductId: "cheese", unitCostSnapshot: 10, lineCost: 0.3 },
      ],
    })
  })

  it("rejects components without a valid cost", () => {
    expect(() => calculateRecipeUnitCost([
      {
        componentProductId: "missing",
        quantityPerUnit: 1,
        componentProduct: { code: "MP-SIN-001", baseUnitCost: null, purchaseToBaseFactor: null },
      },
    ])).toThrow("El componente MP-SIN-001 no tiene un coste válido")
  })

  it("does not divide a prepared component cost by purchase conversion metadata", () => {
    expect(calculateRecipeUnitCost([
      {
        componentProductId: "prepared",
        quantityPerUnit: 1,
        componentProduct: { code: "SE-SEM-001", isPrepared: true, baseUnitCost: 1.25, purchaseToBaseFactor: 10 },
      },
    ]).calculatedUnitCost).toBe(1.25)
  })
})
