import { describe, expect, it } from "vitest"
import { calculateProductPricing } from "../product-pricing"

describe("calculateProductPricing", () => {
  it("calculates VAT-inclusive cost, net sale price, gain and margin", () => {
    expect(calculateProductPricing({
      costSinVat: 10,
      purchaseVatPercentage: 21,
      retailPriceIncludingVat: 20,
      salesVatPercentage: 10,
    })).toEqual({
      purchaseVatPercentage: 21,
      salesVatPercentage: 10,
      vatPercentage: 10,
      costIncludingVat: 12.1,
      targetRetailPriceIncludingVat: null,
      fixedRetailPriceIncludingVat: null,
      appliedRetailPriceIncludingVat: 20,
      retailPriceExcludingVat: 18.1818,
      profitPerUnit: 8.1818,
      actualMarginPercentage: 45,
      percentagePointDeviation: null,
      unitDifference: null,
      pricingDiagnosis: "SIN OBJETIVO",
    })
  })

  it("calculates the target and applied price for the margin method", () => {
    expect(calculateProductPricing({
      costSinVat: 10,
      purchaseVatPercentage: 21,
      salesVatPercentage: 10,
      pricingMethod: "MARGEN",
      targetMarginPercentage: 70,
    })).toMatchObject({
      targetRetailPriceIncludingVat: 36.6667,
      fixedRetailPriceIncludingVat: null,
      appliedRetailPriceIncludingVat: 36.6667,
      retailPriceExcludingVat: 33.3334,
      profitPerUnit: 23.3334,
      actualMarginPercentage: 70,
      percentagePointDeviation: 0,
      unitDifference: 0,
      pricingDiagnosis: "EN OBJETIVO",
    })
  })

  it("uses the single sale price for the fixed method and diagnoses the deviation", () => {
    expect(calculateProductPricing({
      costSinVat: 10,
      salesVatPercentage: 10,
      pricingMethod: "FIJO",
      targetMarginPercentage: 70,
      retailPriceIncludingVat: 20,
    })).toMatchObject({
      targetRetailPriceIncludingVat: 36.6667,
      fixedRetailPriceIncludingVat: 20,
      appliedRetailPriceIncludingVat: 20,
      percentagePointDeviation: -25,
      unitDifference: -16.6667,
      pricingDiagnosis: "MUY POR DEBAJO",
    })
  })

  it("uses the legacy IVA when only ivaPct is available", () => {
    expect(calculateProductPricing({
      costSinVat: 0.74,
      vatPercentage: 4,
      retailPriceIncludingVat: 1.2,
    })).toMatchObject({
      purchaseVatPercentage: 4,
      salesVatPercentage: 4,
      vatPercentage: 4,
      costIncludingVat: 0.7696,
      retailPriceExcludingVat: 1.1538,
    })
  })

  it("does not replace an explicitly cleared IVA with the legacy value", () => {
    expect(calculateProductPricing({
      costSinVat: 10,
      vatPercentage: 21,
      purchaseVatPercentage: "",
      salesVatPercentage: 10,
      retailPriceIncludingVat: 20,
    })).toMatchObject({
      purchaseVatPercentage: null,
      costIncludingVat: null,
      salesVatPercentage: 10,
    })
  })

  it("leaves derived values empty until their inputs exist", () => {
    expect(calculateProductPricing({ costSinVat: 10 })).toMatchObject({
      costIncludingVat: null,
      retailPriceExcludingVat: null,
      profitPerUnit: null,
      actualMarginPercentage: null,
    })
  })

  it.each([
    [5, "PERDIDA"],
    [17, "POR DEBAJO"],
    [19, "AJUSTADO"],
    [25, "POR ENCIMA"],
  ])("diagnoses a fixed sale price of %s correctly", (retailPriceIncludingVat, pricingDiagnosis) => {
    expect(calculateProductPricing({
      costSinVat: 10,
      purchaseVatPercentage: 0,
      salesVatPercentage: 0,
      pricingMethod: "FIJO",
      targetMarginPercentage: 50,
      retailPriceIncludingVat,
    }).pricingDiagnosis).toBe(pricingDiagnosis)
  })

  it("returns missing data for invalid numeric inputs and impossible VAT rates", () => {
    expect(calculateProductPricing({
      costSinVat: "not-a-number",
      purchaseVatPercentage: "not-a-number",
      salesVatPercentage: -100,
      pricingMethod: " desconocido ",
      targetMarginPercentage: 100,
      retailPriceIncludingVat: "not-a-number",
    })).toMatchObject({
      purchaseVatPercentage: null,
      salesVatPercentage: -100,
      costIncludingVat: null,
      targetRetailPriceIncludingVat: null,
      retailPriceExcludingVat: null,
      pricingDiagnosis: "FALTAN DATOS",
    })
  })
})
