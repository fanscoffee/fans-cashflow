import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const tx = {
  $queryRaw: vi.fn(),
  accountingInvoice: { findUnique: vi.fn(), update: vi.fn() },
  invoice: { findUnique: vi.fn() },
  receipt: { updateMany: vi.fn() },
}

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn() } }))
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/payments", () => ({ auditPaymentEvent: vi.fn() }))

import { DELETE } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { auditPaymentEvent } from "@/lib/payments"

const context = { params: Promise.resolve({ id: "capture-1" }) }
const linkedCapture = {
  id: "capture-1",
  inventoryInvoiceId: "invoice-1",
  inventoryInvoice: { id: "invoice-1", entity: "BAKERY", workflowStatus: "DRAFT" },
}

function request(body: unknown) {
  return new Request("http://localhost/api/gestoria/facturas/capture-1/vinculo", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe("DELETE /api/gestoria/facturas/[id]/vinculo", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))
    tx.$queryRaw.mockResolvedValue([])
    tx.accountingInvoice.findUnique.mockResolvedValue(linkedCapture)
    tx.invoice.findUnique.mockResolvedValue({ id: "invoice-1", entity: "BAKERY" })
    tx.receipt.updateMany.mockResolvedValue({ count: 2 })
    tx.accountingInvoice.update.mockResolvedValue({})
    vi.mocked(auditPaymentEvent).mockResolvedValue(undefined as any)
  })

  it("unlinks the capture and receipts without deleting the operational invoice", async () => {
    const response = await DELETE(request({ reason: "Corrección manual de albaranes" }), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, accountingInvoiceId: "capture-1", invoiceId: "invoice-1", unlinkedReceipts: 2 })
    expect(tx.receipt.updateMany).toHaveBeenCalledWith({ where: { invoiceId: "invoice-1" }, data: { invoiceId: null } })
    expect(tx.accountingInvoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ inventoryInvoiceId: null, reconciliationStatus: "UNLINKED" }) }))
    expect(auditPaymentEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "FACTURA_GESTORIA_DESVINCULADA", reason: "Corrección manual de albaranes" }))
  })

  it("allows PARTNER to unlink and rejects other roles", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)

    expect((await DELETE(request({ reason: "Corrección de incidencia" }), context)).status).toBe(200)
    expect(prisma.$transaction).toHaveBeenCalled()

    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)

    expect((await DELETE(request({ reason: "No" }), context)).status).toBe(403)
  })

  it("returns a conflict when the capture is already unlinked", async () => {
    tx.accountingInvoice.findUnique.mockResolvedValue({ id: "capture-1", inventoryInvoiceId: null, inventoryInvoice: null })

    const response = await DELETE(request({ reason: "Corrección" }), context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: "CAPTURE_NOT_LINKED" })
  })
})
