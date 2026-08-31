import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    producto: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { GET } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

function getRequest(url: string) {
  return new Request(url) as unknown as NextRequest
}

describe("GET /api/inventario/recepciones/productos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)
  })

  it("returns only active purchasable products assigned to the selected provider", async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: "product-1", codigo: "MP-HAR-001" },
    ] as any)

    const response = await GET(getRequest("http://localhost/api/inventario/recepciones/productos?proveedorId=provider-1"))

    expect(response.status).toBe(200)
    expect(prisma.producto.findMany).toHaveBeenCalledWith({
      where: {
        esComprable: true,
        estado: "Activo",
        proveedores: { some: { proveedorId: "provider-1" } },
      },
      select: {
        id: true,
        codigo: true,
        descripcionTpv: true,
        umCompra: true,
        costeUmBase: true,
      },
      orderBy: { codigo: "asc" },
    })
    await expect(response.json()).resolves.toEqual({ productos: [{ id: "product-1", codigo: "MP-HAR-001" }] })
  })

  it("returns no products until a provider is selected", async () => {
    const response = await GET(getRequest("http://localhost/api/inventario/recepciones/productos"))

    expect(response.status).toBe(200)
    expect(prisma.producto.findMany).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ productos: [] })
  })
})
