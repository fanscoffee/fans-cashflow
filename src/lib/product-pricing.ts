export type ProductPricingInput = {
  costSinVat?: unknown
  purchaseVatPercentage?: unknown
  salesVatPercentage?: unknown
  vatPercentage?: unknown
  pricingMethod?: unknown
  targetMarginPercentage?: unknown
  retailPriceIncludingVat?: unknown
}

export type ProductPricing = {
  purchaseVatPercentage: number | null
  salesVatPercentage: number | null
  vatPercentage: number | null
  costIncludingVat: number | null
  targetRetailPriceIncludingVat: number | null
  fixedRetailPriceIncludingVat: number | null
  appliedRetailPriceIncludingVat: number | null
  retailPriceExcludingVat: number | null
  profitPerUnit: number | null
  actualMarginPercentage: number | null
  percentagePointDeviation: number | null
  unitDifference: number | null
  pricingDiagnosis: string | null
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const number = typeof value === "number" ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function calculateProductPricing(input: ProductPricingInput): ProductPricing {
  const legacyVat = toNullableNumber(input.vatPercentage)
  const purchaseVatPercentage = input.purchaseVatPercentage === undefined ? legacyVat : toNullableNumber(input.purchaseVatPercentage)
  const salesVatPercentage = input.salesVatPercentage === undefined ? legacyVat : toNullableNumber(input.salesVatPercentage)
  const costSinVat = toNullableNumber(input.costSinVat)
  const pricingMethod = input.pricingMethod === undefined ? null : String(input.pricingMethod).trim().toUpperCase()
  const targetMarginPercentage = toNullableNumber(input.targetMarginPercentage)
  const retailPriceIncludingVat = toNullableNumber(input.retailPriceIncludingVat)

  const costIncludingVat = costSinVat !== null && purchaseVatPercentage !== null
    ? round(costSinVat * (1 + purchaseVatPercentage / 100), 4)
    : null

  const targetRetailPriceExcludingVat = costSinVat !== null && targetMarginPercentage !== null && targetMarginPercentage < 100
    ? costSinVat / (1 - targetMarginPercentage / 100)
    : null
  const targetRetailPriceIncludingVat = targetRetailPriceExcludingVat !== null && salesVatPercentage !== null && salesVatPercentage !== -100
    ? round(targetRetailPriceExcludingVat * (1 + salesVatPercentage / 100), 4)
    : null

  const fixedRetailPriceIncludingVat = pricingMethod === "FIJO" ? retailPriceIncludingVat : null
  const appliedRetailPriceIncludingVat = pricingMethod === "MARGEN"
    ? targetRetailPriceIncludingVat
    : pricingMethod === "FIJO"
      ? fixedRetailPriceIncludingVat
      : retailPriceIncludingVat
  const retailPriceExcludingVatValue = appliedRetailPriceIncludingVat !== null && salesVatPercentage !== null && salesVatPercentage !== -100
    ? appliedRetailPriceIncludingVat / (1 + salesVatPercentage / 100)
    : null
  const retailPriceExcludingVat = retailPriceExcludingVatValue === null ? null : round(retailPriceExcludingVatValue, 4)
  const profitValue = costSinVat !== null && retailPriceExcludingVatValue !== null
    ? retailPriceExcludingVatValue - costSinVat
    : null
  const profitPerUnit = profitValue === null ? null : round(profitValue, 4)
  const actualMarginPercentage = profitValue !== null && retailPriceExcludingVatValue !== null && retailPriceExcludingVatValue !== 0
    ? round((profitValue / retailPriceExcludingVatValue) * 100, 2)
    : null
  const percentagePointDeviation = actualMarginPercentage !== null && targetMarginPercentage !== null && targetRetailPriceIncludingVat !== null
    ? round(actualMarginPercentage - targetMarginPercentage, 2)
    : null
  const unitDifference = appliedRetailPriceIncludingVat !== null && targetRetailPriceIncludingVat !== null
    ? round(appliedRetailPriceIncludingVat - targetRetailPriceIncludingVat, 4)
    : null
  const pricingDiagnosis = targetMarginPercentage === null
    ? "SIN OBJETIVO"
    : targetRetailPriceIncludingVat === null || actualMarginPercentage === null || percentagePointDeviation === null
      ? "FALTAN DATOS"
      : actualMarginPercentage < 0
        ? "PERDIDA"
        : percentagePointDeviation < -15
          ? "MUY POR DEBAJO"
          : percentagePointDeviation < -5
            ? "POR DEBAJO"
            : percentagePointDeviation < -2
              ? "AJUSTADO"
              : percentagePointDeviation <= 5
                ? "EN OBJETIVO"
                : "POR ENCIMA"

  return {
    purchaseVatPercentage,
    salesVatPercentage,
    vatPercentage: salesVatPercentage,
    costIncludingVat,
    targetRetailPriceIncludingVat,
    fixedRetailPriceIncludingVat,
    appliedRetailPriceIncludingVat,
    retailPriceExcludingVat,
    profitPerUnit,
    actualMarginPercentage,
    percentagePointDeviation,
    unitDifference,
    pricingDiagnosis,
  }
}
