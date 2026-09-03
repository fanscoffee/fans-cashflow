const productInputFields = [
  "eanBarcode",
  "posDescription",
  "fullDescription",
  "itemType",
  "family",
  "subfamily",
  "section",
  "isPurchasable",
  "isPrepared",
  "isSellable",
  "hasRecipe",
  "baseStockUnit",
  "purchaseUnit",
  "purchaseToBaseFactor",
  "salesUnit",
  "salesToBaseFactor",
  "netWeightPerUnitGrams",
  "presentationFormat",
  "baseUnitCost",
  "standardWastePercentage",
  "vatCode",
  "vatPercentage",
  "purchaseVatPercentage",
  "salesVatPercentage",
  "pricingMethod",
  "targetMarginPercentage",
  "appliedRetailPriceIncludingVat",
  "stockControl",
  "valuationMethod",
  "minimumStock",
  "maximumStock",
  "reorderPoint",
  "location",
  "abcClass",
  "batchControl",
  "shelfLifeDays",
  "storageConditions",
  "allergens",
  "status",
  "notes",
] as const

const numericLimits: Record<string, { min: number; max: number }> = {
  purchaseToBaseFactor: { min: 0, max: 1_000_000 },
  salesToBaseFactor: { min: 0, max: 1_000_000 },
  netWeightPerUnitGrams: { min: 0, max: 1_000_000_000 },
  baseUnitCost: { min: 0, max: 1_000_000_000 },
  standardWastePercentage: { min: 0, max: 100 },
  vatPercentage: { min: 0, max: 100 },
  purchaseVatPercentage: { min: 0, max: 100 },
  salesVatPercentage: { min: 0, max: 100 },
  targetMarginPercentage: { min: 0, max: 99.99 },
  appliedRetailPriceIncludingVat: { min: 0, max: 1_000_000_000 },
  minimumStock: { min: 0, max: 1_000_000_000 },
  maximumStock: { min: 0, max: 1_000_000_000 },
  reorderPoint: { min: 0, max: 1_000_000_000 },
  shelfLifeDays: { min: 0, max: 100_000 },
}

const stringLimits: Record<string, number> = {
  eanBarcode: 32,
  posDescription: 250,
  fullDescription: 1000,
  itemType: 32,
  family: 120,
  subfamily: 120,
  section: 120,
  baseStockUnit: 32,
  purchaseUnit: 32,
  salesUnit: 32,
  presentationFormat: 250,
  vatCode: 32,
  pricingMethod: 32,
  stockControl: 32,
  valuationMethod: 32,
  location: 120,
  abcClass: 32,
  batchControl: 32,
  storageConditions: 120,
  allergens: 500,
  status: 32,
  notes: 2000,
}

export function pickProductFields(body: Record<string, unknown>) {
  return Object.fromEntries(
    productInputFields
      .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
      .map((field) => [field, body[field]]),
  )
}

export function validateProductInput(body: Record<string, unknown>) {
  for (const [field, limit] of Object.entries(stringLimits)) {
    const value = body[field]
    if (value !== undefined && value !== null && typeof value !== "string") return `${field} no válido`
    if (typeof value === "string" && value.length > limit) return `${field} supera el tamaño permitido`
  }

  for (const [field, limits] of Object.entries(numericLimits)) {
    const value = body[field]
    if (value === undefined || value === null || value === "") continue
    const number = typeof value === "number" ? value : Number(value)
    if (!Number.isFinite(number) || number < limits.min || number > limits.max) return `${field} no válido`
  }

  return null
}
