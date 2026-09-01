import { describe, expect, it } from "vitest"
import { emptyFacturaDraft } from "../factura-ocr"
import { buildGestoriaAmountWarnings, facturaDraftToGestoria, facturaGestoriaSchema } from "../gestoria-facturas"

describe("gestoria-facturas", () => {
  it("maps parsed invoice taxes to the gestoría columns", () => {
    const draft = emptyFacturaDraft()
    draft.fechaExpedicion = "2026-07-15"
    draft.serie = "FAC"
    draft.numero = "100"
    draft.razonSocialEmisor = "Proveedor SA"
    draft.nifEmisor = "B12345678"
    draft.totalNeto = "150.00"
    draft.totalIva = "27.00"
    draft.importeTotal = "177.00"
    draft.lineas[0].descripcion = "Servicio"
    draft.impuestos = [
      { tipo: "IVA", porcentaje: "21", baseImponible: "100", cuota: "21" },
      { tipo: "IVA", porcentaje: "10", baseImponible: "50", cuota: "5" },
      { tipo: "IRPF", porcentaje: "15", baseImponible: "150", cuota: "0" },
    ]

    expect(facturaDraftToGestoria(draft, "texto OCR")).toMatchObject({
      fecha: "2026-07-15",
      facturaNumero: "FAC/100",
      proveedorAcreedor: "",
      nif: "B12345678",
      concepto: "COMPRA",
      base21: "100.00",
      iva21: "21.00",
      base10: "50.00",
      iva10: "5.00",
      totalBase: "150.00",
      totalIva: "27.00",
      totalFactura: "177.00",
      textoOCR: "texto OCR",
      origen: "OCR",
    })
  })

  it("uses total net as exempt base when OCR has no tax rows", () => {
    const draft = emptyFacturaDraft()
    draft.totalNeto = "50"
    draft.importeTotal = "50"
    const result = facturaDraftToGestoria(draft, "")
    expect(result.baseExenta).toBe("50.00")
    expect(result.totalBase).toBe("50.00")
  })

  it("warns about inconsistent totals without rejecting them", () => {
    const parsed = facturaGestoriaSchema.parse({ fecha: "2026-07-15", proveedorAcreedor: "Proveedor", totalFactura: 121, totalBase: 100, totalIva: 20, irpf: 0 })
    expect(buildGestoriaAmountWarnings(parsed)).toEqual(["Importes no cuadran: base 100.00 + IVA 20.00 - IRPF 0.00 != total 121.00"])
  })

  it("rejects impossible dates and missing totals", () => {
    const invalidDate = facturaGestoriaSchema.safeParse({ fecha: "2026-02-31", proveedorAcreedor: "Proveedor", totalFactura: 1 })
    const missingTotal = facturaGestoriaSchema.safeParse({ fecha: "2026-02-28", proveedorAcreedor: "Proveedor", totalFactura: "" })
    expect(invalidDate.success).toBe(false)
    expect(missingTotal.success).toBe(false)
  })
})
