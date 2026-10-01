export type RecipeComponentQuantity = {
  componentProductId: string
  quantityPerUnit: number
}

export type ActualConsumption = {
  componentProductId: string
  quantity: number
}

const QUANTITY_PRECISION = 1_000_000

export function roundOperationalQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * QUANTITY_PRECISION) / QUANTITY_PRECISION
}

export function calculateProductionConsumptions(
  producedQuantity: number,
  tolerancePercentage: number,
  components: RecipeComponentQuantity[],
  actualConsumptions: ActualConsumption[] = [],
) {
  const actualByProduct = new Map(actualConsumptions.map((item) => [item.componentProductId, item.quantity]))
  const componentIds = new Set(components.map((component) => component.componentProductId))
  const unknown = actualConsumptions.find((item) => !componentIds.has(item.componentProductId))
  if (unknown) throw new Error("Se indicó un consumo que no pertenece a la receta")
  if (actualByProduct.size !== actualConsumptions.length) throw new Error("No puedes repetir un componente")

  return components.map((component) => {
    const theoreticalQuantity = roundOperationalQuantity(component.quantityPerUnit * producedQuantity)
    const actualQuantity = roundOperationalQuantity(actualByProduct.get(component.componentProductId) ?? theoreticalQuantity)
    if (!Number.isFinite(actualQuantity) || actualQuantity < 0) throw new Error("El consumo real no es válido")
    const deviationPercentage = theoreticalQuantity === 0
      ? (actualQuantity === 0 ? 0 : 100)
      : Math.abs(actualQuantity - theoreticalQuantity) / theoreticalQuantity * 100

    return {
      componentProductId: component.componentProductId,
      theoreticalQuantity,
      actualQuantity,
      deviationPercentage,
      exceedsTolerance: deviationPercentage > tolerancePercentage + 0.000001,
      hasDeviation: Math.abs(actualQuantity - theoreticalQuantity) >= 0.000001,
    }
  })
}
