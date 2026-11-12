import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import AccountingReconciliationPanel from "../accounting-reconciliation-panel"

describe("AccountingReconciliationPanel permissions", () => {
  afterEach(() => vi.unstubAllGlobals())

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        capture: { id: "capture-1", invoiceNumber: "A/42", taxId: "B12345678", supplierOrCreditor: "Proveedor", invoiceTotal: 10, totalBase: 8, totalVat: 2, documentType: "MERCHANDISE_PURCHASE" },
        status: "LINKED",
        supplier: { id: "supplier-1", legalName: "Proveedor", taxId: "B12345678", billingAddress: null },
        supplierCandidates: [],
        linkedInvoice: { id: "invoice-1", series: "A", number: "42", workflowStatus: "DRAFT", totalAmount: 10, deliveryNotes: [{ id: "receipt-1", deliveryNoteCode: "ALB-1", receivedAt: "2026-08-01T00:00:00.000Z" }] },
        deliveryNotes: [],
        suggestedReceiptIds: [],
        totals: { invoiceBase: 8, invoiceVat: 2, invoiceTotal: 10, availableReceiptBase: 0, availableReceiptTotalWithTransport: 0 },
        alerts: [],
      }),
    }))
  })

  it("does not render the unlink action for a non-admin reviewer", async () => {
    render(<AccountingReconciliationPanel captureId="capture-1" canUnlink={false} onBack={vi.fn()} onComplete={vi.fn()} />)

    expect(await screen.findByText("Factura operativa vinculada")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /desvincular/i })).not.toBeInTheDocument()
  })
})
