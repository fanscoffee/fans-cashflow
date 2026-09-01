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
      pvpObjetivoConIva: null,
      pvpFijoConIva: null,
      pvpAplicadoConIva: 20,
      pvpVentaSinIva: 18.1818,
      gananciaEurUd: 8.1818,
      margenRealPct: 45,
      desviacionPp: null,
      diferenciaEurUd: null,
      diagnosticoPrecio: "SIN OBJETIVO",
    })
  })

  it("calculates the target and applied price for the margin method", () => {
    expect(calculateProductPricing({
      costeSinIva: 10,
      ivaCompraPct: 21,
      ivaVentaPct: 10,
      metodoPrecio: "MARGEN",
      margenObjetivoPct: 70,
    })).toMatchObject({
      pvpObjetivoConIva: 36.6667,
      pvpFijoConIva: null,
      pvpAplicadoConIva: 36.6667,
      pvpVentaSinIva: 33.3334,
      gananciaEurUd: 23.3334,
      margenRealPct: 70,
      desviacionPp: 0,
      diferenciaEurUd: 0,
      diagnosticoPrecio: "EN OBJETIVO",
    })
  })

  it("uses the single sale price for the fixed method and diagnoses the deviation", () => {
    expect(calculateProductPricing({
      costeSinIva: 10,
      ivaVentaPct: 10,
      metodoPrecio: "FIJO",
      margenObjetivoPct: 70,
      pvpVentaConIva: 20,
    })).toMatchObject({
      pvpObjetivoConIva: 36.6667,
      pvpFijoConIva: 20,
      pvpAplicadoConIva: 20,
      desviacionPp: -25,
      diferenciaEurUd: -16.6667,
      diagnosticoPrecio: "MUY POR DEBAJO",
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

  it.each([
    [5, "PERDIDA"],
    [17, "POR DEBAJO"],
    [19, "AJUSTADO"],
    [25, "POR ENCIMA"],
  ])("diagnoses a fixed sale price of %s correctly", (pvpVentaConIva, diagnosticoPrecio) => {
    expect(calculateProductPricing({
      costeSinIva: 10,
      ivaCompraPct: 0,
      ivaVentaPct: 0,
      metodoPrecio: "FIJO",
      margenObjetivoPct: 50,
      pvpVentaConIva,
    }).diagnosticoPrecio).toBe(diagnosticoPrecio)
  })

  it("returns missing data for invalid numeric inputs and impossible VAT rates", () => {
    expect(calculateProductPricing({
      costeSinIva: "not-a-number",
      ivaCompraPct: "not-a-number",
      ivaVentaPct: -100,
      metodoPrecio: " desconocido ",
      margenObjetivoPct: 100,
      pvpVentaConIva: "not-a-number",
    })).toMatchObject({
      ivaCompraPct: null,
      ivaVentaPct: -100,
      costeConIva: null,
      pvpObjetivoConIva: null,
      pvpVentaSinIva: null,
      diagnosticoPrecio: "FALTAN DATOS",
    })
  })
})
