import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    producto: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { DELETE, PATCH } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const context = { params: Promise.resolve({ id: "product-1" }) }

const deleteRequest = new Request("http://localhost/api/inventario/productos/product-1", { method: "DELETE" }) as unknown as NextRequest

function mockRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/inventario/productos/product-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe("PATCH /api/inventario/productos/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } } as any)
  })

  it("does not allow changing the immutable product code", async () => {
    vi.mocked(prisma.producto.findUnique).mockResolvedValue({
      codigo: "MP-HAR-001",
      tipoArticulo: "MP",
      familia: "Harinas y sémolas",
    } as any)

    const response = await PATCH(mockRequest({ codigo: "MP-HAR-002" }), context)

    expect(response.status).toBe(400)
    expect(prisma.producto.update).not.toHaveBeenCalled()
  })

  it("derives flags when updating a standard product", async () => {
    vi.mocked(prisma.producto.findUnique).mockResolvedValue({
      codigo: "MP-HAR-001",
      tipoArticulo: "MP",
      familia: "Harinas y sémolas",
      costeUmBase: 10,
      ivaPct: 10,
      ivaCompraPct: 21,
      ivaVentaPct: 10,
      metodoPrecio: "FIJO",
      margenObjetivoPct: 70,
      pvpFijoConIva: 20,
      pvpAplicadoConIva: 20,
    } as any)
    vi.mocked(prisma.producto.update).mockResolvedValue({ id: "product-1" } as any)

    const response = await PATCH(mockRequest({
      costeUmBase: 10,
      ivaCompraPct: 21,
      ivaVentaPct: 10,
      pvpAplicadoConIva: 20,
      esComprable: false,
      esElaborado: true,
      esVendible: true,
      llevaReceta: true,
      observaciones: "Actualizado",
    }), context)

    expect(response.status).toBe(200)
    expect(prisma.producto.update).toHaveBeenCalledWith({
      where: { id: "product-1" },
      data: {
        costeUmBase: 10,
        ivaCompraPct: 21,
        ivaVentaPct: 10,
        esComprable: true,
        esElaborado: false,
        esVendible: false,
        llevaReceta: false,
        ivaPct: 10,
        costeConIva: 12.1,
        pvpObjetivoConIva: 36.6667,
        pvpFijoConIva: 20,
        pvpAplicadoConIva: 20,
        pvpAplicadoSinIva: 18.1818,
        gananciaEurUd: 8.1818,
        margenRealPct: 45,
        desviacionPp: -25,
        diferenciaEurUd: -16.6667,
        diagnosticoPrecio: "MUY POR DEBAJO",
        observaciones: "Actualizado",
      },
    })
  })
})

describe("DELETE /api/inventario/productos/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("blocks a regular SOCIO", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO", name: "Ana" } } as any)

    const response = await DELETE(deleteRequest, context)

    expect(response.status).toBe(403)
    expect(prisma.producto.delete).not.toHaveBeenCalled()
  })

  it("allows Yomi", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO", name: "yomi" } } as any)
    vi.mocked(prisma.producto.delete).mockResolvedValue({ id: "product-1" } as any)

    const response = await DELETE(deleteRequest, context)

    expect(response.status).toBe(200)
    expect(prisma.producto.delete).toHaveBeenCalledWith({ where: { id: "product-1" } })
  })

  it("allows ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.producto.delete).mockResolvedValue({ id: "product-1" } as any)

    const response = await DELETE(deleteRequest, context)

    expect(response.status).toBe(200)
  })
})
