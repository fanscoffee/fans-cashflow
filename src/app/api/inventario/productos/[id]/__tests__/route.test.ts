import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    producto: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { PATCH } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const context = { params: Promise.resolve({ id: "product-1" }) }

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
    } as any)
    vi.mocked(prisma.producto.update).mockResolvedValue({ id: "product-1" } as any)

    const response = await PATCH(mockRequest({
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
        esComprable: true,
        esElaborado: false,
        esVendible: false,
        llevaReceta: false,
        observaciones: "Actualizado",
      },
    })
  })
})
