import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    physicalInventory: {
      findUnique: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { PATCH } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const context = { params: Promise.resolve({ id: "inventory-1" }) }

function patchRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/inventario/inventario-fisico/inventory-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe("PATCH /api/inventario/inventario-fisico/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.physicalInventory.findUnique).mockResolvedValue({ id: "inventory-1", lines: [] } as any)
    vi.mocked(prisma.product.findMany).mockResolvedValue([{ id: "product-1" }, { id: "product-2" }] as any)
  })

  it("replaces existing lines and updates notes in one transaction", async () => {
    const update = vi.fn().mockResolvedValue({ id: "inventory-1", notes: "Revisado" })
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback({
      physicalInventory: { update },
    }))

    const response = await PATCH(patchRequest({
      notes: "Revisado",
      lines: [
        { productId: "product-1", quantityUnit1: 2, quantityUnit2: 20 },
        { productId: "product-2", quantityUnit1: 1, quantityUnit2: 10 },
      ],
    }), context)

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "inventory-1" },
      data: {
        notes: "Revisado",
        lines: {
          deleteMany: {},
          create: [
            { productId: "product-1", quantityUnit1: 2, quantityUnit2: 20 },
            { productId: "product-2", quantityUnit1: 1, quantityUnit2: 10 },
          ],
        },
      },
    }))
  })

  it("rejects products that cannot be counted", async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([])

    const response = await PATCH(patchRequest({
      lines: [{ productId: "inactive-product", quantityUnit1: 0, quantityUnit2: 0 }],
    }), context)

    expect(response.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
