import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const tx = {
  recepcion: { updateMany: vi.fn() },
  factura: { delete: vi.fn(), update: vi.fn() },
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    factura: { findUnique: vi.fn(), findFirst: vi.fn() },
    proveedor: { findUnique: vi.fn() },
    recepcion: { findMany: vi.fn() },
    producto: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/pagos", () => ({
  auditPaymentEvent: vi.fn(),
  ensureAcreedorForProveedor: vi.fn(),
}))

vi.mock("@/lib/pagos-storage", () => ({
  getPaymentStorage: vi.fn(),
  paymentStorageBucket: "payment-documents",
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { DELETE, GET, PATCH } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { auditPaymentEvent, ensureAcreedorForProveedor } from "@/lib/pagos"
import { getPaymentStorage } from "@/lib/pagos-storage"

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
    proveedorId: "provider-1",
    entidad: "OBRADOR",
    tipoDocumento: "COMPRA_MERCANCIA",
    cifReceptor: "B09711078",
    serie: "A",
    numero: "42",
    fechaExpedicion: "2026-08-01",
    razonSocialEmisor: "Proveedor",
    nifEmisor: "B12345678",
    domicilioFiscalEmisor: "Calle Mayor 1",
    totalNeto: 10,
    totalDescuento: 0,
    totalIva: 2.1,
    totalRecargo: 0,
    totalRetenciones: 0,
    importeTotal: 12.1,
    recepcionIds: [],
    lineas: [{
      productoId: "product-1",
      tipoLinea: "PRODUCTO",
      descripcion: "Harina",
      cantidad: 2,
      descuentoImporte: 0,
      precioUnitario: 5,
      precioUnitarioNeto: 5,
      baseImponible: 10,
      cuotaIva: 2.1,
      totalLinea: 12.1,
    }],
    impuestos: [],
    ...overrides,
  }
}

describe("GET/PATCH /api/inventario/facturas/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))
    vi.mocked(ensureAcreedorForProveedor).mockResolvedValue({ id: "creditor-1" } as any)
    vi.mocked(tx.recepcion.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(tx.factura.update).mockResolvedValue({ id: "invoice-1" } as any)
  })

  it("allows ADMIN and SOCIO to read an invoice and rejects other roles", async () => {
    const readRequest = new Request("http://localhost/api/inventario/facturas/invoice-1") as unknown as NextRequest
    vi.mocked(prisma.factura.findUnique).mockResolvedValue({ id: "invoice-1", numero: "42" } as any)

    const response = await GET(readRequest, context)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ id: "invoice-1", numero: "42" })

    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)
    const forbidden = await GET(readRequest, context)
    expect(forbidden.status).toBe(403)
  })

  it("returns 404 when the invoice to read does not exist", async () => {
    vi.mocked(prisma.factura.findUnique).mockResolvedValue(null)

    const response = await GET(new Request("http://localhost/api/inventario/facturas/missing") as unknown as NextRequest, context)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "Factura no encontrada" })
  })

  it("updates a draft invoice, links its products and resets its circuit state", async () => {
    vi.mocked(prisma.factura.findUnique)
      .mockResolvedValueOnce({ id: "invoice-1", estadoCircuito: "BORRADOR" } as any)
    vi.mocked(prisma.proveedor.findUnique).mockResolvedValue({ id: "provider-1", cifNif: "B-12345678" } as any)
    vi.mocked(prisma.factura.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.producto.findMany).mockResolvedValue([{ id: "product-1" }] as any)

    const response = await PATCH(patchRequest(validPatchBody({ nifEmisor: "B 12345678" })), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ factura: { id: "invoice-1" }, alertas: [] })
    expect(ensureAcreedorForProveedor).toHaveBeenCalledWith(tx, {
      id: "provider-1",
      razonSocial: "Proveedor",
      cifNif: "B 12345678",
    }, "admin-1")
    expect(tx.factura.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "invoice-1" },
      data: expect.objectContaining({ estadoCircuito: "BORRADOR", proveedorId: "provider-1" }),
    }))
  })

  it("rejects PATCH requests that fail authorization or invoice validation", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)
    expect((await PATCH(patchRequest(validPatchBody()), context)).status).toBe(403)

    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.factura.findUnique).mockResolvedValueOnce({ id: "invoice-1", estadoCircuito: "CONFORMADA" } as any)
    expect((await PATCH(patchRequest(validPatchBody()), context)).status).toBe(409)

    vi.mocked(prisma.factura.findUnique).mockResolvedValueOnce(null)
    expect((await PATCH(patchRequest({}), context)).status).toBe(404)

    vi.mocked(prisma.factura.findUnique).mockResolvedValueOnce({ id: "invoice-1", estadoCircuito: "BORRADOR" } as any)
    expect((await PATCH(patchRequest({}), context)).status).toBe(400)
  })

  it("rejects a provider mismatch, duplicate invoice or unavailable reception", async () => {
    vi.mocked(prisma.factura.findUnique).mockResolvedValue({ id: "invoice-1", estadoCircuito: "BORRADOR" } as any)
    vi.mocked(prisma.proveedor.findUnique).mockResolvedValue({ id: "provider-1", cifNif: "B-99999999" } as any)
    expect((await PATCH(patchRequest(validPatchBody()), context)).status).toBe(400)

    vi.mocked(prisma.proveedor.findUnique).mockResolvedValue({ id: "provider-1", cifNif: "B12345678" } as any)
    vi.mocked(prisma.factura.findFirst).mockResolvedValue({ id: "other-invoice" } as any)
    expect((await PATCH(patchRequest(validPatchBody()), context)).status).toBe(409)

    vi.mocked(prisma.factura.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.recepcion.findMany).mockResolvedValue([])
    expect((await PATCH(patchRequest(validPatchBody({ recepcionIds: ["reception-1"] })), context)).status).toBe(409)
  })

  it("rejects unknown catalog products and returns transaction errors", async () => {
    vi.mocked(prisma.factura.findUnique).mockResolvedValue({ id: "invoice-1", estadoCircuito: "BORRADOR" } as any)
    vi.mocked(prisma.proveedor.findUnique).mockResolvedValue({ id: "provider-1", cifNif: "B12345678" } as any)
    vi.mocked(prisma.factura.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.producto.findMany).mockResolvedValue([])
    expect((await PATCH(patchRequest(validPatchBody()), context)).status).toBe(400)

    vi.mocked(prisma.producto.findMany).mockResolvedValue([{ id: "product-1" }] as any)
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
    vi.mocked(prisma.factura.findUnique).mockResolvedValue({
      id: "invoice-1",
      entidad: "OBRADOR",
      serie: "A",
      numero: "42",
      estado: "CONFIRMADA",
      estadoPago: "PENDIENTE",
      estadoCircuito: "BORRADOR",
      importePagado: null,
      importeTotal: 121,
      adjuntos: [],
      _count: { aplicaciones: 0 },
    } as any)
    vi.mocked(tx.recepcion.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(tx.factura.delete).mockResolvedValue({ id: "invoice-1" } as any)
    vi.mocked(auditPaymentEvent).mockResolvedValue(undefined as any)
    vi.mocked(getPaymentStorage).mockReturnValue(null)
  })

  it("only allows ADMIN and SOCIO to delete invoices", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)

    const response = await DELETE(request, context)

    expect(response.status).toBe(403)
    expect(prisma.factura.findUnique).not.toHaveBeenCalled()
  })

  it("allows SOCIO to delete an invoice", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)

    const response = await DELETE(request, context)

    expect(response.status).toBe(200)
    expect(tx.factura.delete).toHaveBeenCalledWith({ where: { id: "invoice-1" } })
  })

  it("blocks invoices with payments", async () => {
    vi.mocked(prisma.factura.findUnique).mockResolvedValue({
      id: "invoice-1",
      estadoPago: "PAGADA",
      importePagado: 121,
      _count: { aplicaciones: 1 },
      adjuntos: [],
    } as any)

    const response = await DELETE(request, context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: "INVOICE_HAS_PAYMENTS" })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("returns not found when the invoice cannot be deleted", async () => {
    vi.mocked(prisma.factura.findUnique).mockResolvedValue(null)

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
    vi.mocked(prisma.factura.findUnique).mockResolvedValue({
      id: "invoice-1",
      entidad: "OBRADOR",
      serie: "A",
      numero: "42",
      estado: "CONFIRMADA",
      estadoPago: "PENDIENTE",
      estadoCircuito: "BORRADOR",
      importePagado: null,
      importeTotal: 121,
      adjuntos: [{ storageKey: "obrador/facturas/invoice-1/file.pdf" }],
      _count: { aplicaciones: 0 },
    } as any)
    vi.mocked(getPaymentStorage).mockReturnValue({
      storage: { from: vi.fn().mockReturnValue({ remove }) },
    } as any)

    const response = await DELETE(request, context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ok: true, id: "invoice-1" })
    expect(tx.recepcion.updateMany).toHaveBeenCalledWith({ where: { facturaId: "invoice-1" }, data: { facturaId: null } })
    expect(tx.factura.delete).toHaveBeenCalledWith({ where: { id: "invoice-1" } })
    expect(auditPaymentEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ accion: "FACTURA_ELIMINADA", registroId: "invoice-1" }))
    expect(remove).toHaveBeenCalledWith(["obrador/facturas/invoice-1/file.pdf"])
  })
})
