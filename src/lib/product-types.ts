export const PRODUCT_TYPE_BEHAVIOR = {
  MP: { esComprable: true, esElaborado: false, esVendible: false, llevaReceta: false },
  IN: { esComprable: true, esElaborado: false, esVendible: false, llevaReceta: false },
  SE: { esComprable: false, esElaborado: true, esVendible: false, llevaReceta: true },
  PT: { esComprable: false, esElaborado: true, esVendible: true, llevaReceta: true },
  RV: { esComprable: true, esElaborado: false, esVendible: true, llevaReceta: false },
} as const

export function getProductTypeBehavior(tipo: string) {
  return PRODUCT_TYPE_BEHAVIOR[tipo as keyof typeof PRODUCT_TYPE_BEHAVIOR]
}
