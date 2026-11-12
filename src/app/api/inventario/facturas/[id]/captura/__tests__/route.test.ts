import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const tx = {
  $queryRaw: vi.fn(),
  invoice: { findUnique: vi.fn() },
  accountingInvoice: { findUnique: vi.fn(), update: vi.fn() },
}

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn() } }))
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/payments", () => ({ auditPaymentEvent: vi.fn() }))

import { POST } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { auditPaymentEvent } from "@/lib/payments"

const context = { params: Promise.resolve({ id: "invoice-1" }) }
const invoice = {
  id: "invoice-1",
  series: "A",
  number: "42",
  entity: "BAKERY",
  supplierId: "supplier-1",
  supplier: { id: "supplier-1", legalName: "Proveedor Uno", taxId: "B12345678" },
  accountingInvoice: null,
}
const capture = {
  id: "capture-1",
  invoiceNumber: "A/42",
  taxId: "B12345678",
  documentType: "MERCHANDISE_PURCHASE",
  inventoryInvoiceId: null,
}

function request(body: unknown) {
  return new Request("http://localhost/api/inventario/facturas/invoice-1/captura", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe("POST /api/inventario/facturas/[id]/captura", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))
    tx.$queryRaw.mockResolvedValue([])
    tx.invoice.findUnique.mockResolvedValue(invoice)
    tx.accountingInvoice.findUnique.mockResolvedValue(capture)
    tx.accountingInvoice.update.mockResolvedValue({ id: "capture-1", inventoryInvoiceId: "invoice-1", reconciliationStatus: "LINKED" })
    vi.mocked(auditPaymentEvent).mockResolvedValue(undefined as any)
  })

  it("allows SOCIO to link a matching unlinked capture", async () => {
    const response = await POST(request({ accountingInvoiceId: "capture-1" }), context)

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ invoiceId: "invoice-1", accountingInvoice: { inventoryInvoiceId: "invoice-1", reconciliationStatus: "LINKED" } })
    expect(tx.accountingInvoice.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "capture-1" }, data: expect.objectContaining({ inventoryInvoiceId: "invoice-1", supplierId: "supplier-1", reconciliationStatus: "LINKED" }) }))
    expect(auditPaymentEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "CAPTURA_GESTORIA_VINCULADA_A_FACTURA" }))
  })

  it("rejects employees before opening a transaction", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)

    expect((await POST(request({ accountingInvoiceId: "capture-1" }), context)).status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("rejects a capture with a different invoice number", async () => {
    tx.accountingInvoice.findUnique.mockResolvedValue({ ...capture, invoiceNumber: "B/99" })

    const response = await POST(request({ accountingInvoiceId: "capture-1" }), context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: "INVOICE_NUMBER_MISMATCH" })
    expect(tx.accountingInvoice.update).not.toHaveBeenCalled()
  })
})
