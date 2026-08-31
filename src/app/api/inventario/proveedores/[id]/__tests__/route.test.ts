import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    proveedor: { findUnique: vi.fn(), delete: vi.fn() },
    proveedorProducto: { count: vi.fn() },
    recepcion: { count: vi.fn() },
    factura: { count: vi.fn() },
    acreedor: { count: vi.fn() },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { DELETE } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const context = { params: Promise.resolve({ id: "provider-1" }) }
const request = new Request("http://localhost/api/inventario/proveedores/provider-1", { method: "DELETE" }) as unknown as NextRequest

describe("DELETE /api/inventario/proveedores/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.proveedor.findUnique).mockResolvedValue({ id: "provider-1" } as any)
    vi.mocked(prisma.proveedorProducto.count).mockResolvedValue(0)
    vi.mocked(prisma.recepcion.count).mockResolvedValue(0)
    vi.mocked(prisma.factura.count).mockResolvedValue(0)
    vi.mocked(prisma.acreedor.count).mockResolvedValue(0)
  })

  it("blocks deletion when the provider is linked to products", async () => {
    vi.mocked(prisma.proveedorProducto.count).mockResolvedValue(2)

    const response = await DELETE(request, context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: "PROVIDER_HAS_LINKS",
      vinculaciones: { productos: 2, recepciones: 0, facturas: 0, acreedores: 0 },
    })
    expect(prisma.proveedor.delete).not.toHaveBeenCalled()
  })

  it("blocks deletion when the provider has any other link", async () => {
    vi.mocked(prisma.recepcion.count).mockResolvedValue(1)
    vi.mocked(prisma.factura.count).mockResolvedValue(3)
    vi.mocked(prisma.acreedor.count).mockResolvedValue(1)

    const response = await DELETE(request, context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      vinculaciones: { productos: 0, recepciones: 1, facturas: 3, acreedores: 1 },
    })
    expect(prisma.proveedor.delete).not.toHaveBeenCalled()
  })

  it("deletes a provider with no links", async () => {
    vi.mocked(prisma.proveedor.delete).mockResolvedValue({ id: "provider-1" } as any)

    const response = await DELETE(request, context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ok: true })
    expect(prisma.proveedor.delete).toHaveBeenCalledWith({ where: { id: "provider-1" } })
  })

  it("allows SOCIO to delete a provider with no links", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)
    vi.mocked(prisma.proveedor.delete).mockResolvedValue({ id: "provider-1" } as any)

    const response = await DELETE(request, context)

    expect(response.status).toBe(200)
    expect(prisma.proveedor.delete).toHaveBeenCalledWith({ where: { id: "provider-1" } })
  })
})
