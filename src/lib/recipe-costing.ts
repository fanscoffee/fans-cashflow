import { calculateProductPricingCost } from "@/lib/product-pricing"

export type RecipeCostComponent = {
  componentProductId: string
  quantityPerUnit: number
  componentProduct: {
    code: string
    isPrepared?: boolean
    baseUnitCost: number | null
    purchaseToBaseFactor: number | null
  }
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function calculateRecipeUnitCost(components: RecipeCostComponent[]) {
  if (components.length === 0) throw new Error("La receta no tiene componentes")

  const snapshots = components.map((component) => {
    const unitCost = component.componentProduct.isPrepared
      ? component.componentProduct.baseUnitCost
      : calculateProductPricingCost({
          baseUnitCost: component.componentProduct.baseUnitCost,
          purchaseToBaseFactor: component.componentProduct.purchaseToBaseFactor,
        })
    if (unitCost === null) {
      throw new Error(`El componente ${component.componentProduct.code} no tiene un coste válido`)
    }
    return {
      componentProductId: component.componentProductId,
      unitCostSnapshot: round(unitCost, 6),
      lineCost: round(component.quantityPerUnit * unitCost, 6),
    }
  })

  return {
    calculatedUnitCost: round(snapshots.reduce((total, snapshot) => total + snapshot.lineCost, 0), 4),
    snapshots,
  }
}
