import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const tx = {
  recepcion: { updateMany: vi.fn() },
  factura: { delete: vi.fn() },
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    factura: { findUnique: vi.fn() },
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

import { DELETE } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { auditPaymentEvent } from "@/lib/pagos"
import { getPaymentStorage } from "@/lib/pagos-storage"

const context = { params: Promise.resolve({ id: "invoice-1" }) }
const request = new Request("http://localhost/api/inventario/facturas/invoice-1", { method: "DELETE" }) as unknown as NextRequest

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
