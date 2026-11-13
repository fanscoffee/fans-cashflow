import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }))

import { useSession } from "next-auth/react"
import AccountingPanel from "../accounting-panel"

const capture = {
  id: "capture-1",
  date: "2026-08-01T00:00:00.000Z",
  invoiceNumber: "A/42",
  supplierOrCreditor: "Proveedor Uno",
  taxId: "B12345678",
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
  source: "OCR" as const,
  entity: "COFFEE_SHOP" as const,
  documentType: "MERCHANDISE_PURCHASE" as const,
  reconciliationStatus: "SUGGESTED" as const,
  alerts: null,
  createdAt: "2026-08-01T10:00:00.000Z",
}

const suggestions = {
  capture,
  status: "SUGGESTED",
  supplier: { id: "supplier-1", legalName: "Proveedor Uno", taxId: "B12345678", billingAddress: "Calle Mayor 1" },
  supplierCandidates: [{ id: "supplier-1", legalName: "Proveedor Uno", taxId: "B12345678", billingAddress: "Calle Mayor 1", score: 160, reasons: ["NIF coincidente"] }],
  linkedInvoice: null,
  deliveryNotes: [{ id: "receipt-1", deliveryNoteCode: "ALB-1", receivedAt: "2026-08-01T00:00:00.000Z", lineCount: 1, productIds: ["product-1"], baseTotal: 10, transportCost: 0, totalWithTransport: 10, score: 80, reasons: ["base coincidente"], lines: [] }],
  suggestedReceiptIds: ["receipt-1"],
  totals: { invoiceBase: 10, invoiceVat: 2.1, invoiceTotal: 12.1, availableReceiptBase: 10, availableReceiptTotalWithTransport: 10 },
  alerts: [],
}

describe("AccountingPanel reconciliation navigation", () => {
  afterEach(() => vi.unstubAllGlobals())

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "partner-1", role: "PARTNER" } }, status: "authenticated" } as any)
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/sugerencias")) return { ok: true, json: async () => suggestions }
      return { ok: true, json: async () => ({ invoices: [capture], total: 1 }) }
    }))
  })

  it("shows document type and reconciliation status and opens the manual assistant", async () => {
    render(<AccountingPanel />)

    await screen.findByText("A/42")
    expect(screen.getByText("Compra de mercancía")).toBeInTheDocument()
    expect(screen.getByText("Cafetería")).toBeInTheDocument()
    expect(screen.getByText("Sugerida")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Acciones" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "Vincular albaranes" }))

    await waitFor(() => expect(screen.getByText("Conciliación de gestoría")).toBeInTheDocument())
    expect(screen.getByText("Selecciona y confirma manualmente")).toBeInTheDocument()
    expect(screen.getByText("ALB-1")).toBeInTheDocument()
  })

  it("filters the list by month without requiring a year", async () => {
    render(<AccountingPanel />)

    await screen.findByText("A/42")
    fireEvent.change(screen.getByLabelText("Filtrar por mes"), { target: { value: "11" } })

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenLastCalledWith("/api/gestoria/facturas?page=1&pageSize=20&month=11"))
  })
})
