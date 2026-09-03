import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const tx = {
  receipt: { updateMany: vi.fn() },
  invoice: { delete: vi.fn(), update: vi.fn() },
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: { findUnique: vi.fn(), findFirst: vi.fn() },
    supplier: { findUnique: vi.fn() },
    receipt: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/payments", () => ({
  auditPaymentEvent: vi.fn(),
  ensureCreditorForSupplier: vi.fn(),
}))

vi.mock("@/lib/payments-storage", () => ({
  getPaymentStorage: vi.fn(),
  paymentStorageBucket: "payment-documents",
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { DELETE, GET, PATCH } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { auditPaymentEvent, ensureCreditorForSupplier } from "@/lib/payments"
import { getPaymentStorage } from "@/lib/payments-storage"

const context = { params: Promise.resolve({ id: "invoice-1" }) }
const request = new Request("http://localhost/api/inventario/facturas/invoice-1", { method: "DELETE" }) as unknown as NextRequest

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/inventario/facturas/invoice-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

function validPatchBody(overrides: Record<string, unknown> = {}) {
  return {
    supplierId: "provider-1",
    entity: "OBRADOR",
    documentType: "COMPRA_MERCANCIA",
    recipientTaxId: "B09711078",
    series: "A",
    number: "42",
    issueDate: "2026-08-01",
    issuerLegalName: "Proveedor",
    issuerTaxId: "B12345678",
    issuerBillingAddress: "Calle Mayor 1",
    netTotal: 10,
    discountTotal: 0,
    totalVat: 2.1,
    surchargeTotal: 0,
    withholdingTotal: 0,
    totalAmount: 12.1,
    receiptIds: [],
    lines: [{
      productId: "product-1",
      lineType: "PRODUCTO",
      description: "Harina",
      quantity: 2,
      discountAmount: 0,
      unitPrice: 5,
      netUnitPrice: 5,
      taxableBase: 10,
      vatAmount: 2.1,
      lineTotal: 12.1,
    }],
    taxes: [],
    ...overrides,
  }
}

describe("GET/PATCH /api/inventario/facturas/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))
    vi.mocked(ensureCreditorForSupplier).mockResolvedValue({ id: "creditor-1" } as any)
    vi.mocked(tx.receipt.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(tx.invoice.update).mockResolvedValue({ id: "invoice-1" } as any)
  })

  it("allows ADMIN and PARTNER to read an invoice and rejects other roles", async () => {
    const readRequest = new Request("http://localhost/api/inventario/facturas/invoice-1") as unknown as NextRequest
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({ id: "invoice-1", number: "42" } as any)

    const response = await GET(readRequest, context)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ id: "invoice-1", number: "42" })

    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)
    const forbidden = await GET(readRequest, context)
    expect(forbidden.status).toBe(403)
  })

  it("returns 404 when the invoice to read does not exist", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(null)

    const response = await GET(new Request("http://localhost/api/inventario/facturas/missing") as unknown as NextRequest, context)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "Factura no encontrada" })
  })

  it("updates a draft invoice, links its products and resets its circuit state", async () => {
    vi.mocked(prisma.invoice.findUnique)
      .mockResolvedValueOnce({ id: "invoice-1", workflowStatus: "BORRADOR" } as any)
    vi.mocked(prisma.supplier.findUnique).mockResolvedValue({ id: "provider-1", taxId: "B-12345678" } as any)
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.product.findMany).mockResolvedValue([{ id: "product-1" }] as any)

    const response = await PATCH(patchRequest(validPatchBody({ issuerTaxId: "B 12345678" })), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ invoice: { id: "invoice-1" }, alerts: [] })
    expect(ensureCreditorForSupplier).toHaveBeenCalledWith(tx, {
      id: "provider-1",
      legalName: "Proveedor",
      taxId: "B 12345678",
    }, "admin-1")
    expect(tx.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "invoice-1" },
      data: expect.objectContaining({ workflowStatus: "DRAFT", supplierId: "provider-1" }),
    }))
  })

  it("rejects PATCH requests that fail authorization or invoice validation", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)
    expect((await PATCH(patchRequest(validPatchBody()), context)).status).toBe(403)

    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.invoice.findUnique).mockResolvedValueOnce({ id: "invoice-1", workflowStatus: "CONFORMADA" } as any)
    expect((await PATCH(patchRequest(validPatchBody()), context)).status).toBe(409)

    vi.mocked(prisma.invoice.findUnique).mockResolvedValueOnce(null)
    expect((await PATCH(patchRequest({}), context)).status).toBe(404)

    vi.mocked(prisma.invoice.findUnique).mockResolvedValueOnce({ id: "invoice-1", workflowStatus: "BORRADOR" } as any)
    expect((await PATCH(patchRequest({}), context)).status).toBe(400)
  })

  it("rejects a provider mismatch, duplicate invoice or unavailable reception", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({ id: "invoice-1", workflowStatus: "BORRADOR" } as any)
    vi.mocked(prisma.supplier.findUnique).mockResolvedValue({ id: "provider-1", taxId: "B-99999999" } as any)
    expect((await PATCH(patchRequest(validPatchBody()), context)).status).toBe(400)

    vi.mocked(prisma.supplier.findUnique).mockResolvedValue({ id: "provider-1", taxId: "B12345678" } as any)
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({ id: "other-invoice" } as any)
    expect((await PATCH(patchRequest(validPatchBody()), context)).status).toBe(409)

    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.receipt.findMany).mockResolvedValue([])
    expect((await PATCH(patchRequest(validPatchBody({ receiptIds: ["reception-1"] })), context)).status).toBe(409)
  })

  it("rejects unknown catalog products and returns transaction errors", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({ id: "invoice-1", workflowStatus: "BORRADOR" } as any)
    vi.mocked(prisma.supplier.findUnique).mockResolvedValue({ id: "provider-1", taxId: "B12345678" } as any)
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.product.findMany).mockResolvedValue([])
    expect((await PATCH(patchRequest(validPatchBody()), context)).status).toBe(400)

    vi.mocked(prisma.product.findMany).mockResolvedValue([{ id: "product-1" }] as any)
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("transaction failed"))
    const response = await PATCH(patchRequest(validPatchBody()), context)
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "transaction failed" })
  })
})

describe("DELETE /api/inventario/facturas/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({
      id: "invoice-1",
      entity: "OBRADOR",
      series: "A",
      number: "42",
      status: "CONFIRMADA",
      paymentStatus: "PENDIENTE",
      workflowStatus: "BORRADOR",
      paidAmount: null,
      totalAmount: 121,
      attachments: [],
      _count: { applications: 0 },
    } as any)
    vi.mocked(tx.receipt.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(tx.invoice.delete).mockResolvedValue({ id: "invoice-1" } as any)
    vi.mocked(auditPaymentEvent).mockResolvedValue(undefined as any)
    vi.mocked(getPaymentStorage).mockReturnValue(null)
  })

  it("only allows ADMIN and PARTNER to delete invoices", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)

    const response = await DELETE(request, context)

    expect(response.status).toBe(403)
    expect(prisma.invoice.findUnique).not.toHaveBeenCalled()
  })

  it("allows PARTNER to delete an invoice", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)

    const response = await DELETE(request, context)

    expect(response.status).toBe(200)
    expect(tx.invoice.delete).toHaveBeenCalledWith({ where: { id: "invoice-1" } })
  })

  it("blocks invoices with payments", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({
      id: "invoice-1",
      paymentStatus: "PAGADA",
      paidAmount: 121,
      _count: { applications: 1 },
      attachments: [],
    } as any)

    const response = await DELETE(request, context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: "INVOICE_HAS_PAYMENTS" })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("returns not found when the invoice cannot be deleted", async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(null)

    const response = await DELETE(request, context)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "Factura no encontrada" })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("returns a server error when deletion fails", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("delete failed"))

    const response = await DELETE(request, context)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "delete failed" })
  })

  it("deletes the invoice, unlinks receptions and removes storage attachments", async () => {
    const remove = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({
      id: "invoice-1",
      entity: "OBRADOR",
      series: "A",
      number: "42",
      status: "CONFIRMADA",
      paymentStatus: "PENDIENTE",
      workflowStatus: "BORRADOR",
      paidAmount: null,
      totalAmount: 121,
      attachments: [{ storageKey: "obrador/facturas/invoice-1/file.pdf" }],
      _count: { applications: 0 },
    } as any)
    vi.mocked(getPaymentStorage).mockReturnValue({
      storage: { from: vi.fn().mockReturnValue({ remove }) },
    } as any)

    const response = await DELETE(request, context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ok: true, id: "invoice-1" })
    expect(tx.receipt.updateMany).toHaveBeenCalledWith({ where: { invoiceId: "invoice-1" }, data: { invoiceId: null } })
    expect(tx.invoice.delete).toHaveBeenCalledWith({ where: { id: "invoice-1" } })
    expect(auditPaymentEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "FACTURA_ELIMINADA", recordId: "invoice-1" }))
    expect(remove).toHaveBeenCalledWith(["obrador/facturas/invoice-1/file.pdf"])
  })
})
