import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplier: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
    supplierProduct: { count: vi.fn() },
    receipt: { count: vi.fn() },
    invoice: { count: vi.fn() },
    creditor: { count: vi.fn() },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { DELETE, GET, PATCH } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const context = { params: Promise.resolve({ id: "provider-1" }) }
const request = new Request("http://localhost/api/inventario/proveedores/provider-1", { method: "DELETE" }) as unknown as NextRequest

describe("DELETE /api/inventario/proveedores/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.supplier.findUnique).mockResolvedValue({ id: "provider-1" } as any)
    vi.mocked(prisma.supplierProduct.count).mockResolvedValue(0)
    vi.mocked(prisma.receipt.count).mockResolvedValue(0)
    vi.mocked(prisma.invoice.count).mockResolvedValue(0)
    vi.mocked(prisma.creditor.count).mockResolvedValue(0)
  })

  it("blocks deletion when the provider is linked to products", async () => {
    vi.mocked(prisma.supplierProduct.count).mockResolvedValue(2)

    const response = await DELETE(request, context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: "PROVIDER_HAS_LINKS",
      links: { products: 2, receipts: 0, invoices: 0, creditors: 0 },
      vinculaciones: { products: 2, receipts: 0, invoices: 0, creditors: 0 },
    })
    expect(prisma.supplier.delete).not.toHaveBeenCalled()
  })

  it("blocks deletion when the provider has any other link", async () => {
    vi.mocked(prisma.receipt.count).mockResolvedValue(1)
    vi.mocked(prisma.invoice.count).mockResolvedValue(3)
    vi.mocked(prisma.creditor.count).mockResolvedValue(1)

    const response = await DELETE(request, context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      links: { products: 0, receipts: 1, invoices: 3, creditors: 1 },
      vinculaciones: { products: 0, receipts: 1, invoices: 3, creditors: 1 },
    })
    expect(prisma.supplier.delete).not.toHaveBeenCalled()
  })

  it("deletes a provider with no links", async () => {
    vi.mocked(prisma.supplier.delete).mockResolvedValue({ id: "provider-1" } as any)

    const response = await DELETE(request, context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ok: true })
    expect(prisma.supplier.delete).toHaveBeenCalledWith({ where: { id: "provider-1" } })
  })

  it("blocks a regular SOCIO from deleting a provider", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)

    const response = await DELETE(request, context)

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("Yomi") })
    expect(prisma.supplier.delete).not.toHaveBeenCalled()
  })

  it("allows Yomi to delete a provider with no links", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO", name: "Yomi" } } as any)
    vi.mocked(prisma.supplier.delete).mockResolvedValue({ id: "provider-1" } as any)

    const response = await DELETE(request, context)

    expect(response.status).toBe(200)
    expect(prisma.supplier.delete).toHaveBeenCalledWith({ where: { id: "provider-1" } })
  })
})

describe("GET/PATCH /api/inventario/proveedores/[id]", () => {
  const getRequest = new Request("http://localhost/api/inventario/proveedores/provider-1") as unknown as NextRequest
  const patchRequest = (body: unknown) => new Request("http://localhost/api/inventario/proveedores/provider-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
  const context = { params: Promise.resolve({ id: "provider-1" }) }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.supplier.findUnique).mockResolvedValue({ id: "provider-1", legalName: "Proveedor", products: [] } as any)
    vi.mocked(prisma.supplier.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.supplier.update).mockResolvedValue({ id: "provider-1", legalName: "Proveedor actualizado" } as any)
  })

  it("gets a provider and returns not found when it is missing", async () => {
    const response = await GET(getRequest, context)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ id: "provider-1", products: [] })

    vi.mocked(prisma.supplier.findUnique).mockResolvedValue(null)
    expect((await GET(getRequest, context)).status).toBe(404)
  })

  it("updates a provider and rejects duplicate CIF/NIF values", async () => {
    const response = await PATCH(patchRequest({ legalName: "Proveedor actualizado" }), context)
    expect(response.status).toBe(200)
    expect(prisma.supplier.update).toHaveBeenCalledWith({
      where: { id: "provider-1" },
      data: { legalName: "Proveedor actualizado" },
    })

    vi.mocked(prisma.supplier.findFirst).mockResolvedValue({ id: "provider-2" } as any)
    const conflict = await PATCH(patchRequest({ taxId: "B12345678" }), context)
    expect(conflict.status).toBe(400)
    await expect(conflict.json()).resolves.toMatchObject({ error: expect.stringContaining("B12345678") })
  })

  it("returns persistence errors from provider updates", async () => {
    vi.mocked(prisma.supplier.update).mockRejectedValue(new Error("provider update failed"))

    const response = await PATCH(patchRequest({ legalName: "Proveedor actualizado" }), context)
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "provider update failed" })
  })
})
