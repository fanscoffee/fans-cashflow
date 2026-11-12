import { describe, expect, it } from "vitest"
import {
  buildInvoiceTaxes,
  buildOperationalInvoiceDraft,
  rankSupplierCandidates,
  resolveSupplierForLink,
  splitAccountingInvoiceNumber,
  type AccountingCaptureForReconciliation,
  type ReconciliationReceipt,
  type ReconciliationSupplier,
} from "../accounting-reconciliation"

const supplier: ReconciliationSupplier = {
  id: "supplier-1",
  legalName: "Proveedor Uno",
  taxId: "B12345678",
  billingAddress: "Calle Mayor 1",
}

const capture: AccountingCaptureForReconciliation = {
  id: "capture-1",
  date: new Date("2026-08-01T00:00:00.000Z"),
  invoiceNumber: "A/42",
  supplierOrCreditor: "Proveedor Uno",
  taxId: "B 12345678",
  concept: "COMPRA",
  exemptBase: 0,
  base21: 10,
  vat21: 2.1,
  base10: 0,
  vat10: 0,
  base4: 0,
  vat4: 0,
  base2: 0,
  vat2: 0,
  totalBase: 10,
  totalVat: 2.1,
  withholdingTax: 0,
  invoiceTotal: 12.1,
  paymentMethod: "TRANSFERENCIA",
  documentType: null,
  alerts: null,
}

const receipt: ReconciliationReceipt = {
  id: "receipt-1",
  deliveryNoteCode: "ALB-1",
  supplierId: "supplier-1",
  receivedAt: new Date("2026-08-01T00:00:00.000Z"),
  transportCost: 0,
  lines: [{
    productId: "product-1",
    receivedQuantity: 2,
    unitPrice: 5,
    batch: null,
    dueDate: null,
    product: { code: "P-1", posDescription: "Harina", purchaseUnit: "kg", purchaseVatPercentage: 21 },
  }],
}

describe("accounting reconciliation", () => {
  it("splits a gestoría number into series and number", () => {
    expect(splitAccountingInvoiceNumber(" a / 42 ")).toEqual({ series: "A", number: "42" })
    expect(splitAccountingInvoiceNumber("42")).toEqual({ series: "", number: "42" })
  })

  it("ranks exact tax ID matches above name-only candidates", () => {
    const candidates = rankSupplierCandidates({ taxId: "B12345678", supplierOrCreditor: "Proveedor" }, [
      supplier,
      { ...supplier, id: "supplier-2", legalName: "Proveedor Similar", taxId: "B99999999" },
    ])
    expect(candidates[0]).toMatchObject({ supplier: { id: "supplier-1" }, score: 125 })
  })

  it("requires an explicit reason for a provider NIF exception", () => {
    expect(() => resolveSupplierForLink({ ...capture, taxId: "" }, [supplier], "supplier-1", undefined)).toThrowError(/no tiene NIF/i)
    expect(resolveSupplierForLink({ ...capture, taxId: "" }, [supplier], "supplier-1", "Factura legible y proveedor confirmado")).toMatchObject({
      supplier,
      taxIdMismatch: true,
    })
  })

  it("builds operational lines and preserves the captured tax breakdown", () => {
    const draft = buildOperationalInvoiceDraft({ capture, supplier, receipts: [receipt], entity: "BAKERY", includeTransport: true })
    expect(draft).toMatchObject({ series: "A", number: "42", netTotal: 10, totalVat: 2.1, totalAmount: 12.1, workflowStatus: "DRAFT" })
    expect(draft.lines[0]).toMatchObject({ productId: "product-1", quantity: 2, taxableBase: 10, vatRate: 21, vatAmount: 2.1, lineTotal: 12.1 })
    expect(draft.taxes).toEqual([{ type: "IVA", percentage: 21, taxableBase: 10, taxAmount: 2.1 }])
  })

  it("marks a draft as ISSUE when the selected receptions do not match the capture", () => {
    const draft = buildOperationalInvoiceDraft({
      capture: { ...capture, totalBase: 12, invoiceTotal: 14.52 },
      supplier,
      receipts: [receipt],
      entity: "BAKERY",
      includeTransport: true,
    })
    expect(draft.workflowStatus).toBe("ISSUE")
    expect(draft.alerts.some((alert) => alert.includes("Diferencia de base"))).toBe(true)
  })

  it("creates an IRPF tax row when the capture includes withholding", () => {
    expect(buildInvoiceTaxes({ ...capture, withholdingTax: 15 })).toContainEqual({ type: "IRPF", percentage: null, taxableBase: 0, taxAmount: 15 })
  })
})
