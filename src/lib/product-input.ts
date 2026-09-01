const productInputFields = [
  "codBarrasEan",
  "descripcionTpv",
  "descripcionCompleta",
  "tipoArticulo",
  "familia",
  "subfamilia",
  "seccion",
  "esComprable",
  "esElaborado",
  "esVendible",
  "llevaReceta",
  "umBaseStock",
  "umCompra",
  "factorCompraABase",
  "umVenta",
  "factorVentaABase",
  "pesoNetoUdG",
  "formatoPresentacion",
  "costeUmBase",
  "mermaEstandarPct",
  "codIva",
  "ivaPct",
  "ivaCompraPct",
  "ivaVentaPct",
  "metodoPrecio",
  "margenObjetivoPct",
  "pvpAplicadoConIva",
  "controlaStock",
  "metodoValoracion",
  "stockMinimo",
  "stockMaximo",
  "puntoPedido",
  "ubicacion",
  "claseAbc",
  "controlLote",
  "vidaUtilDias",
  "conservacion",
  "alergenos",
  "estado",
  "observaciones",
] as const

const numericLimits: Record<string, { min: number; max: number }> = {
  factorCompraABase: { min: 0, max: 1_000_000 },
  factorVentaABase: { min: 0, max: 1_000_000 },
  pesoNetoUdG: { min: 0, max: 1_000_000_000 },
  costeUmBase: { min: 0, max: 1_000_000_000 },
  mermaEstandarPct: { min: 0, max: 100 },
  ivaPct: { min: 0, max: 100 },
  ivaCompraPct: { min: 0, max: 100 },
  ivaVentaPct: { min: 0, max: 100 },
  margenObjetivoPct: { min: 0, max: 99.99 },
  pvpAplicadoConIva: { min: 0, max: 1_000_000_000 },
  stockMinimo: { min: 0, max: 1_000_000_000 },
  stockMaximo: { min: 0, max: 1_000_000_000 },
  puntoPedido: { min: 0, max: 1_000_000_000 },
  vidaUtilDias: { min: 0, max: 100_000 },
}

const stringLimits: Record<string, number> = {
  codBarrasEan: 32,
  descripcionTpv: 250,
  descripcionCompleta: 1000,
  tipoArticulo: 32,
  familia: 120,
  subfamilia: 120,
  seccion: 120,
  umBaseStock: 32,
  umCompra: 32,
  umVenta: 32,
  formatoPresentacion: 250,
  codIva: 32,
  metodoPrecio: 32,
  controlaStock: 32,
  metodoValoracion: 32,
  ubicacion: 120,
  claseAbc: 32,
  controlLote: 32,
  conservacion: 120,
  alergenos: 500,
  estado: 32,
  observaciones: 2000,
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
