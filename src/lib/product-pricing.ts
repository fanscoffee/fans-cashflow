export type ProductPricingInput = {
  costeSinIva?: unknown
  ivaCompraPct?: unknown
  ivaVentaPct?: unknown
  ivaPct?: unknown
  metodoPrecio?: unknown
  margenObjetivoPct?: unknown
  pvpVentaConIva?: unknown
}

export type ProductPricing = {
  ivaCompraPct: number | null
  ivaVentaPct: number | null
  ivaPct: number | null
  costeConIva: number | null
  pvpObjetivoConIva: number | null
  pvpFijoConIva: number | null
  pvpAplicadoConIva: number | null
  pvpVentaSinIva: number | null
  gananciaEurUd: number | null
  margenRealPct: number | null
  desviacionPp: number | null
  diferenciaEurUd: number | null
  diagnosticoPrecio: string | null
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
  const metodoPrecio = input.metodoPrecio === undefined ? null : String(input.metodoPrecio).trim().toUpperCase()
  const margenObjetivoPct = toNullableNumber(input.margenObjetivoPct)
  const pvpVentaConIva = toNullableNumber(input.pvpVentaConIva)

  const costeConIva = costeSinIva !== null && ivaCompraPct !== null
    ? round(costeSinIva * (1 + ivaCompraPct / 100), 4)
    : null

  const pvpObjetivoSinIva = costeSinIva !== null && margenObjetivoPct !== null && margenObjetivoPct < 100
    ? costeSinIva / (1 - margenObjetivoPct / 100)
    : null
  const pvpObjetivoConIva = pvpObjetivoSinIva !== null && ivaVentaPct !== null && ivaVentaPct !== -100
    ? round(pvpObjetivoSinIva * (1 + ivaVentaPct / 100), 4)
    : null

  const pvpFijoConIva = metodoPrecio === "FIJO" ? pvpVentaConIva : null
  const pvpAplicadoConIva = metodoPrecio === "MARGEN"
    ? pvpObjetivoConIva
    : metodoPrecio === "FIJO"
      ? pvpFijoConIva
      : pvpVentaConIva
  const pvpVentaSinIvaValue = pvpAplicadoConIva !== null && ivaVentaPct !== null && ivaVentaPct !== -100
    ? pvpAplicadoConIva / (1 + ivaVentaPct / 100)
    : null
  const pvpVentaSinIva = pvpVentaSinIvaValue === null ? null : round(pvpVentaSinIvaValue, 4)
  const gananciaValue = costeSinIva !== null && pvpVentaSinIvaValue !== null
    ? pvpVentaSinIvaValue - costeSinIva
    : null
  const gananciaEurUd = gananciaValue === null ? null : round(gananciaValue, 4)
  const margenRealPct = gananciaValue !== null && pvpVentaSinIvaValue !== null && pvpVentaSinIvaValue !== 0
    ? round((gananciaValue / pvpVentaSinIvaValue) * 100, 2)
    : null
  const desviacionPp = margenRealPct !== null && margenObjetivoPct !== null && pvpObjetivoConIva !== null
    ? round(margenRealPct - margenObjetivoPct, 2)
    : null
  const diferenciaEurUd = pvpAplicadoConIva !== null && pvpObjetivoConIva !== null
    ? round(pvpAplicadoConIva - pvpObjetivoConIva, 4)
    : null
  const diagnosticoPrecio = margenObjetivoPct === null
    ? "SIN OBJETIVO"
    : pvpObjetivoConIva === null || margenRealPct === null || desviacionPp === null
      ? "FALTAN DATOS"
      : margenRealPct < 0
        ? "PERDIDA"
        : desviacionPp < -15
          ? "MUY POR DEBAJO"
          : desviacionPp < -5
            ? "POR DEBAJO"
            : desviacionPp < -2
              ? "AJUSTADO"
              : desviacionPp <= 5
                ? "EN OBJETIVO"
                : "POR ENCIMA"

  return {
    ivaCompraPct,
    ivaVentaPct,
    ivaPct: ivaVentaPct,
    costeConIva,
    pvpObjetivoConIva,
    pvpFijoConIva,
    pvpAplicadoConIva,
    pvpVentaSinIva,
    gananciaEurUd,
    margenRealPct,
    desviacionPp,
    diferenciaEurUd,
    diagnosticoPrecio,
  }
}
