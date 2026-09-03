import { describe, expect, it } from "vitest"
import { emptyInvoiceDraft } from "../invoice-ocr"
import { buildAccountingAmountWarnings, invoiceDraftToAccounting, accountingInvoiceSchema } from "../accounting-invoices"

describe("accounting-invoices", () => {
  it("maps parsed invoice taxes to the accounting columns", () => {
    const draft = emptyInvoiceDraft()
    draft.issueDate = "2026-07-15"
    draft.series = "FAC"
    draft.number = "100"
    draft.issuerLegalName = "Proveedor SA"
    draft.issuerTaxId = "B12345678"
    draft.netTotal = "150.00"
    draft.totalVat = "27.00"
    draft.totalAmount = "177.00"
    draft.lines[0].description = "Servicio"
    draft.taxes = [
      { type: "IVA", percentage: "21", taxableBase: "100", taxAmount: "21" },
      { type: "IVA", percentage: "10", taxableBase: "50", taxAmount: "5" },
      { type: "IRPF", percentage: "15", taxableBase: "150", taxAmount: "0" },
    ]

    expect(invoiceDraftToAccounting(draft, "texto OCR")).toMatchObject({
      date: "2026-07-15",
      invoiceNumber: "FAC/100",
      supplierOrCreditor: "Proveedor SA",
      taxId: "B12345678",
      concept: "COMPRA",
      base21: "100.00",
      vat21: "21.00",
      base10: "50.00",
      vat10: "5.00",
      totalBase: "150.00",
      totalVat: "27.00",
      invoiceTotal: "177.00",
      ocrText: "texto OCR",
      source: "OCR",
    })
  })

  it("uses total net as exempt base when OCR has no tax rows", () => {
    const draft = emptyInvoiceDraft()
    draft.netTotal = "50"
    draft.totalAmount = "50"
    const result = invoiceDraftToAccounting(draft, "")
    expect(result.exemptBase).toBe("50.00")
    expect(result.totalBase).toBe("50.00")
  })

  it("keeps the supplier empty when OCR did not identify one", () => {
    const draft = emptyInvoiceDraft()
    draft.issuerLegalName = "  "
    expect(invoiceDraftToAccounting(draft, "").supplierOrCreditor).toBe("")
  })

  it("warns about inconsistent totals without rejecting them", () => {
    const parsed = accountingInvoiceSchema.parse({ date: "2026-07-15", supplierOrCreditor: "Proveedor", invoiceTotal: 121, totalBase: 100, totalVat: 20, withholdingTax: 0 })
    expect(buildAccountingAmountWarnings(parsed)).toEqual(["Importes no cuadran: base 100.00 + IVA 20.00 - IRPF 0.00 != total 121.00"])
  })

  it("rejects impossible dates and missing totals", () => {
    const invalidDate = accountingInvoiceSchema.safeParse({ date: "2026-02-31", supplierOrCreditor: "Proveedor", invoiceTotal: 1 })
    const missingTotal = accountingInvoiceSchema.safeParse({ date: "2026-02-28", supplierOrCreditor: "Proveedor", invoiceTotal: "" })
    expect(invalidDate.success).toBe(false)
    expect(missingTotal.success).toBe(false)
  })
})
