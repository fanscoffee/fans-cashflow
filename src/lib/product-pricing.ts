export type ProductPricingInput = {
  costeSinIva?: unknown
  ivaCompraPct?: unknown
  ivaVentaPct?: unknown
  ivaPct?: unknown
  pvpVentaConIva?: unknown
}

export type ProductPricing = {
  ivaCompraPct: number | null
  ivaVentaPct: number | null
  ivaPct: number | null
  costeConIva: number | null
  pvpVentaSinIva: number | null
  gananciaEurUd: number | null
  margenRealPct: number | null
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
  const legacyIva = toNullableNumber(input.ivaPct)
  const ivaCompraPct = input.ivaCompraPct === undefined ? legacyIva : toNullableNumber(input.ivaCompraPct)
  const ivaVentaPct = input.ivaVentaPct === undefined ? legacyIva : toNullableNumber(input.ivaVentaPct)
  const costeSinIva = toNullableNumber(input.costeSinIva)
  const pvpVentaConIva = toNullableNumber(input.pvpVentaConIva)

  const costeConIva = costeSinIva !== null && ivaCompraPct !== null
    ? round(costeSinIva * (1 + ivaCompraPct / 100), 4)
    : null
  const pvpVentaSinIvaValue = pvpVentaConIva !== null && ivaVentaPct !== null && ivaVentaPct !== -100
    ? pvpVentaConIva / (1 + ivaVentaPct / 100)
    : null
  const pvpVentaSinIva = pvpVentaSinIvaValue === null ? null : round(pvpVentaSinIvaValue, 4)
  const gananciaValue = costeSinIva !== null && pvpVentaSinIvaValue !== null
    ? pvpVentaSinIvaValue - costeSinIva
    : null
  const gananciaEurUd = gananciaValue === null ? null : round(gananciaValue, 4)
  const margenRealPct = gananciaValue !== null && pvpVentaSinIvaValue !== null && pvpVentaSinIvaValue !== 0
    ? round((gananciaValue / pvpVentaSinIvaValue) * 100, 2)
    : null

  return {
    ivaCompraPct,
    ivaVentaPct,
    ivaPct: ivaVentaPct,
    costeConIva,
    pvpVentaSinIva,
    gananciaEurUd,
    margenRealPct,
  }
}
