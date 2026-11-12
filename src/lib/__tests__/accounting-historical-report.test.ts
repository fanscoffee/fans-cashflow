import { describe, expect, it } from "vitest"
import {
  AccountingReconciliationStatus,
  PaymentDocumentType,
} from "../database-enums"
import {
  buildHistoricalAccountingReport,
  type HistoricalAccountingCapture,
  type HistoricalReceipt,
} from "../accounting-historical-report"
import type { ReconciliationSupplier } from "../accounting-reconciliation"

const supplier: ReconciliationSupplier = {
  id: "supplier-1",
  legalName: "Proveedor Uno",
  taxId: "B12345678",
  billingAddress: "Calle Mayor 1",
}

const secondSupplier: ReconciliationSupplier = {
  id: "supplier-2",
  legalName: "Proveedor Dos",
  taxId: "B87654321",
  billingAddress: "Calle Menor 2",
}

function capture(overrides: Partial<HistoricalAccountingCapture> = {}): HistoricalAccountingCapture {
  return {
    id: "capture-1",
    date: new Date("2026-08-01T00:00:00.000Z"),
    invoiceNumber: "A/42",
    supplierOrCreditor: supplier.legalName,
    taxId: supplier.taxId,
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
    reconciliationStatus: AccountingReconciliationStatus.UNLINKED,
    supplierId: null,
    inventoryInvoiceId: null,
    linkedAt: null,
    linkedById: null,
    alerts: null,
    ...overrides,
  }
}

function receipt(
  id: string,
  receivedAt: string,
  base: number,
  overrides: Partial<HistoricalReceipt> = {},
): HistoricalReceipt {
  return {
    id,
    deliveryNoteCode: `ALB-${id}`,
    supplierId: supplier.id,
    invoiceId: null,
    receivedAt: new Date(receivedAt),
    transportCost: 0,
    lines: [{
      productId: `product-${id}`,
      receivedQuantity: 1,
      unitPrice: base,
      batch: null,
      dueDate: null,
      product: { code: `P-${id}`, posDescription: "Harina", purchaseUnit: "kg", purchaseVatPercentage: 21 },
    }],
    ...overrides,
  }
}

function report(
  captures: HistoricalAccountingCapture[],
  receipts: HistoricalReceipt[],
  invoices: HistoricalAccountingCapture["inventoryInvoice"][] = [],
) {
  return buildHistoricalAccountingReport({
    captures,
    suppliers: [supplier, secondSupplier],
    receipts,
    invoices: invoices.filter((invoice): invoice is NonNullable<typeof invoice> => Boolean(invoice)),
  })
}

describe("accounting historical report", () => {
  it("classifies a strong single-receipt match as level A", () => {
    const result = report(
      [capture()],
      [receipt("receipt-a", "2026-08-01T08:00:00.000Z", 10, { deliveryNoteCode: "ALB-A42" })],
    )

    const captureReport = result.captures[0]
    expect(captureReport.bestCandidate).toMatchObject({
      level: "A",
      receiptIds: ["receipt-a"],
      referenceMatch: true,
    })
    expect(captureReport.linkedReceiptIds).toEqual([])
    expect(captureReport.reviewState).toBe("PENDING")
    expect(result.counts.captureWithCandidatesCount).toBe(1)
  })

  it("classifies same-NIF, nearby, amount-compatible matches as level B", () => {
    const result = report(
      [capture({ invoiceNumber: "B/7", date: new Date("2026-08-01T00:00:00.000Z") })],
      [receipt("receipt-b", "2026-08-03T08:00:00.000Z", 10)],
    )

    expect(result.captures[0].bestCandidate).toMatchObject({ level: "B", referenceMatch: false })
  })

  it("keeps name-only matches at level C", () => {
    const result = report(
      [capture({ taxId: "", supplierOrCreditor: supplier.legalName, invoiceNumber: "SIN-REFERENCIA" })],
      [receipt("receipt-c", "2026-08-02T08:00:00.000Z", 10)],
    )

    expect(result.captures[0].bestCandidate?.level).toBe("C")
    expect(result.captures[0].supplierCandidates[0].reasons).toContain("nombre coincidente")
  })

  it("detects a grouped candidate without selecting or writing it", () => {
    const captures = [capture({ invoiceNumber: "G/10", totalBase: 15, invoiceTotal: 18.15 })]
    const receipts = [
      receipt("receipt-g1", "2026-08-01T08:00:00.000Z", 10),
      receipt("receipt-g2", "2026-08-02T08:00:00.000Z", 5),
    ]
    const result = report(captures, receipts)
    const grouped = result.captures[0].bestGroupedCandidate

    expect(grouped).toMatchObject({
      level: "B",
      isGrouped: true,
      receiptCount: 2,
      receiptIds: ["receipt-g1", "receipt-g2"],
    })
    expect(result.counts.groupedCandidateCaptureCount).toBe(1)
    expect(result.readOnly).toBe(true)
    expect(receipts.every((item) => item.invoiceId === null)).toBe(true)
    expect(captures[0].inventoryInvoiceId).toBeNull()
  })

  it("reports expenses as effective NO_APLICA without changing their stored status", () => {
    const expense = capture({
      documentType: PaymentDocumentType.EXPENSE,
      reconciliationStatus: AccountingReconciliationStatus.UNLINKED,
    })
    const result = report([expense], [receipt("receipt-expense", "2026-08-01T08:00:00.000Z", 10)])
    const expenseReport = result.captures[0]

    expect(expenseReport.effectiveStatus).toBe(AccountingReconciliationStatus.NOT_APPLICABLE)
    expect(expenseReport.recommendedAction).toBe("MARK_NOT_APPLICABLE")
    expect(expenseReport.receiptCandidates).toEqual([])
    expect(result.counts.expensesNotApplicableCount).toBe(1)
    expect(expense.reconciliationStatus).toBe(AccountingReconciliationStatus.UNLINKED)
  })

  it("keeps linked captures visible and counts free receipts separately", () => {
    const linkedInvoice = {
      id: "invoice-1",
      supplierId: supplier.id,
      series: "A",
      number: "42",
      issueDate: new Date("2026-08-01T00:00:00.000Z"),
      totalAmount: 12.1,
      workflowStatus: "DRAFT",
      deliveryNotes: [{ id: "receipt-linked", deliveryNoteCode: "ALB-LINKED", receivedAt: new Date("2026-08-01T08:00:00.000Z") }],
    }
    const linkedCapture = capture({
      inventoryInvoiceId: linkedInvoice.id,
      inventoryInvoice: linkedInvoice,
      reconciliationStatus: AccountingReconciliationStatus.LINKED,
      linkedAt: new Date("2026-08-02T00:00:00.000Z"),
      linkedById: "user-1",
    })
    const result = report(
      [linkedCapture],
      [
        receipt("receipt-linked", "2026-08-01T08:00:00.000Z", 10, { invoiceId: linkedInvoice.id, deliveryNoteCode: "ALB-LINKED" }),
        receipt("receipt-free", "2026-08-03T08:00:00.000Z", 20),
      ],
      [linkedInvoice],
    )

    expect(result.captures[0]).toMatchObject({
      reviewState: "LINKED",
      linkedInvoiceId: "invoice-1",
      linkedReceiptIds: ["receipt-linked"],
      linkedInvoice: { number: "42", deliveryNoteCodes: ["ALB-LINKED"] },
    })
    expect(result.counts).toMatchObject({
      linkedCaptureCount: 1,
      linkedReceiptCount: 1,
      unlinkedReceiptCount: 1,
      invoiceCount: 1,
    })
    expect(result.pendingReceipts.map((item) => item.id)).toEqual(["receipt-free"])
  })
})
