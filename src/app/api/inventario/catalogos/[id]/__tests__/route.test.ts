import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    catalogo: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    producto: {
      count: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { DELETE } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

describe("DELETE /api/inventario/catalogos/[id]", () => {
  const context = { params: Promise.resolve({ id: "section-1" }) }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requires authentication", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)

    const response = await DELETE(
      new Request("http://localhost/api/inventario/catalogos/section-1") as unknown as NextRequest,
      context,
    )

    expect(response.status).toBe(401)
  })

  it("deletes an unused section permanently", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.catalogo.findUnique).mockResolvedValue({ tipo: "SECCION", valor: "Panadería" } as any)
    vi.mocked(prisma.producto.count).mockResolvedValue(0)

    const response = await DELETE(
      new Request("http://localhost/api/inventario/catalogos/section-1?permanente=true") as unknown as NextRequest,
      context,
    )

    expect(response.status).toBe(200)
    expect(prisma.catalogo.delete).toHaveBeenCalledWith({ where: { id: "section-1" } })
  })

  it("rejects permanent deletion when products use the section", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.catalogo.findUnique).mockResolvedValue({ tipo: "SECCION", valor: "Panadería" } as any)
    vi.mocked(prisma.producto.count).mockResolvedValue(2)

    const response = await DELETE(
      new Request("http://localhost/api/inventario/catalogos/section-1?permanente=true") as unknown as NextRequest,
      context,
    )

    expect(response.status).toBe(409)
    expect(prisma.catalogo.delete).not.toHaveBeenCalled()
  })

  it("deletes an unused family permanently", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.catalogo.findUnique).mockResolvedValue({ tipo: "FAMILIA", valor: "Pan" } as any)
    vi.mocked(prisma.producto.count).mockResolvedValue(0)

    const response = await DELETE(
      new Request("http://localhost/api/inventario/catalogos/family-1?permanente=true") as unknown as NextRequest,
      { params: Promise.resolve({ id: "family-1" }) },
    )

    expect(response.status).toBe(200)
    expect(prisma.producto.count).toHaveBeenCalledWith({ where: { OR: [{ familia: "Pan" }] } })
    expect(prisma.catalogo.delete).toHaveBeenCalledWith({ where: { id: "family-1" } })
  })

  it("deletes an unused provider catalog entry permanently", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.catalogo.findUnique).mockResolvedValue({ tipo: "PROVEEDOR", valor: "Proveedor local" } as any)

    const response = await DELETE(
      new Request("http://localhost/api/inventario/catalogos/provider-1?permanente=true") as unknown as NextRequest,
      { params: Promise.resolve({ id: "provider-1" }) },
    )

    expect(response.status).toBe(200)
    expect(prisma.producto.count).not.toHaveBeenCalled()
    expect(prisma.catalogo.delete).toHaveBeenCalledWith({ where: { id: "provider-1" } })
  })
})
