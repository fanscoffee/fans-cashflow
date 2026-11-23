import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { GET } from "../route"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: { product: { findMany: vi.fn() } },
}))

const request = new Request("http://localhost/api/inventario/inventario-fisico/productos") as NextRequest

describe("GET /api/inventario/inventario-fisico/productos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the primary supplier, the active alternatives, or an empty list", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)
    const alternatives = [
      { isPrimary: false, supplier: { legalName: "Proveedor A" } },
      { isPrimary: false, supplier: { legalName: "Proveedor B" } },
    ]
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { id: "product-1", suppliers: [...alternatives, { isPrimary: true, supplier: { legalName: "Proveedor principal" } }] },
      { id: "product-2", suppliers: alternatives },
      { id: "product-3", suppliers: [] },
    ] as any)

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ products: [
      { id: "product-1", supplierNames: ["Proveedor principal"] },
      { id: "product-2", supplierNames: ["Proveedor A", "Proveedor B"] },
      { id: "product-3", supplierNames: [] },
    ] })
    expect(prisma.product.findMany).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      where: { stockControl: "SI", status: { equals: "Activo", mode: "insensitive" } },
      orderBy: { code: "asc" },
      select: expect.objectContaining({
        suppliers: {
          where: { active: true },
          orderBy: { supplier: { legalName: "asc" } },
          select: { isPrimary: true, supplier: { select: { legalName: true } } },
        },
      }),
    }))
  })

  it("does not look up suppliers for an unauthenticated user or an employee", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    expect((await GET(request)).status).toBe(401)

    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "employee-1", role: "EMPLEADO" } } as any)
    expect((await GET(request)).status).toBe(403)
    expect(prisma.product.findMany).not.toHaveBeenCalled()
  })
})
