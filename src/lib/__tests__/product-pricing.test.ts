import { describe, expect, it } from "vitest"
import { calculateProductPricing } from "../product-pricing"

describe("calculateProductPricing", () => {
  it("calculates VAT-inclusive cost, net sale price, gain and margin", () => {
    expect(calculateProductPricing({
      costeSinIva: 10,
      ivaCompraPct: 21,
      pvpVentaConIva: 20,
      ivaVentaPct: 10,
    })).toEqual({
      ivaCompraPct: 21,
      ivaVentaPct: 10,
      ivaPct: 10,
      costeConIva: 12.1,
      pvpVentaSinIva: 18.1818,
      gananciaEurUd: 8.1818,
      margenRealPct: 45,
    })
  })

  it("uses the legacy IVA when only ivaPct is available", () => {
    expect(calculateProductPricing({
      costeSinIva: 0.74,
      ivaPct: 4,
      pvpVentaConIva: 1.2,
    })).toMatchObject({
      ivaCompraPct: 4,
      ivaVentaPct: 4,
      ivaPct: 4,
      costeConIva: 0.7696,
      pvpVentaSinIva: 1.1538,
    })
  })

  it("does not replace an explicitly cleared IVA with the legacy value", () => {
    expect(calculateProductPricing({
      costeSinIva: 10,
      ivaPct: 21,
      ivaCompraPct: "",
      ivaVentaPct: 10,
      pvpVentaConIva: 20,
    })).toMatchObject({
      ivaCompraPct: null,
      costeConIva: null,
      ivaVentaPct: 10,
    })
  })

  it("leaves derived values empty until their inputs exist", () => {
    expect(calculateProductPricing({ costeSinIva: 10 })).toMatchObject({
      costeConIva: null,
      pvpVentaSinIva: null,
      gananciaEurUd: null,
      margenRealPct: null,
    })
  })
})
