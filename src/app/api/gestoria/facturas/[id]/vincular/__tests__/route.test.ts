import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const tx = {
  $queryRaw: vi.fn(),
  accountingInvoice: { findUnique: vi.fn(), update: vi.fn() },
  supplier: { findMany: vi.fn() },
  receipt: { findMany: vi.fn(), updateMany: vi.fn() },
  invoice: { findUnique: vi.fn(), create: vi.fn() },
}

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn() } }))
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/payments", () => ({ auditPaymentEvent: vi.fn(), ensureCreditorForSupplier: vi.fn() }))

import { POST } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { auditPaymentEvent, ensureCreditorForSupplier } from "@/lib/payments"

const context = { params: Promise.resolve({ id: "capture-1" }) }

const capture = {
  id: "capture-1",
  date: new Date("2026-08-01T00:00:00.000Z"),
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
  documentType: null,
  reconciliationStatus: "UNLINKED",
  supplierId: null,
  inventoryInvoiceId: null,
  alerts: null,
  inventoryInvoice: null,
}

const supplier = { id: "supplier-1", legalName: "Proveedor Uno", taxId: "B12345678", billingAddress: "Calle Mayor 1" }
const receipt = {
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

function request(body: unknown) {
  return new Request("http://localhost/api/gestoria/facturas/capture-1/vincular", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe("POST /api/gestoria/facturas/[id]/vincular", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))
    tx.$queryRaw.mockResolvedValue([{ id: "receipt-1" }])
    tx.accountingInvoice.findUnique.mockResolvedValue(capture)
    tx.supplier.findMany.mockResolvedValue([supplier])
    tx.receipt.findMany.mockResolvedValue([receipt])
    tx.receipt.updateMany.mockResolvedValue({ count: 1 })
    tx.invoice.findUnique.mockResolvedValue(null)
    tx.invoice.create.mockResolvedValue({ id: "invoice-1", workflowStatus: "DRAFT", totalAmount: 12.1 })
    tx.accountingInvoice.update.mockResolvedValue({ ...capture, inventoryInvoiceId: "invoice-1" })
    vi.mocked(ensureCreditorForSupplier).mockResolvedValue({ id: "creditor-1" } as any)
    vi.mocked(auditPaymentEvent).mockResolvedValue(undefined as any)
  })

  it("creates one operational invoice, links the receipt and audits the operation", async () => {
    const response = await POST(request({ receiptIds: ["receipt-1"], entity: "BAKERY" }), context)

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ invoice: { id: "invoice-1", workflowStatus: "DRAFT" }, alerts: [] })
    expect(tx.invoice.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ workflowStatus: "DRAFT", sourceReference: "GESTORIA:capture-1" }) }))
    expect(tx.receipt.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["receipt-1"] }, invoiceId: null }, data: { invoiceId: "invoice-1" } })
    expect(tx.accountingInvoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ inventoryInvoiceId: "invoice-1", reconciliationStatus: "LINKED" }) }))
    expect(auditPaymentEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "FACTURA_GESTORIA_VINCULADA", recordId: "capture-1" }))
  })

  it("returns the existing link on a repeated request instead of creating a duplicate", async () => {
    tx.accountingInvoice.findUnique.mockResolvedValue({
      ...capture,
      inventoryInvoiceId: "invoice-1",
      inventoryInvoice: { id: "invoice-1", deliveryNotes: [{ id: "receipt-1" }], alerts: [] },
    })

    const response = await POST(request({ receiptIds: ["receipt-1"] }), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ idempotent: true, invoice: { id: "invoice-1" } })
    expect(tx.invoice.create).not.toHaveBeenCalled()
  })

  it("rejects an unavailable receipt without creating partial data", async () => {
    tx.$queryRaw.mockResolvedValue([])

    const response = await POST(request({ receiptIds: ["receipt-1"] }), context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: "RECEIPT_NOT_FOUND" })
    expect(tx.invoice.create).not.toHaveBeenCalled()
    expect(tx.accountingInvoice.update).not.toHaveBeenCalled()
  })

  it("does not allow an employee to invoke the endpoint", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)

    const response = await POST(request({ receiptIds: ["receipt-1"] }), context)

    expect(response.status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
