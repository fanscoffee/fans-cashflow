import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { GET } from "../route"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    physicalInventory: { findUnique: vi.fn(), findFirst: vi.fn() },
    receiptLine: { findMany: vi.fn() },
  },
}))

function inventoryLine(productId: string, suppliers: { isPrimary: boolean; supplier: { legalName: string } }[]) {
  return {
    quantityUnit1: 0,
    quantityUnit2: 5,
    product: { id: productId, baseStockUnit: "kg", suppliers },
  }
}

describe("GET /api/inventario/inventario-fisico/[id]/comparacion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "PARTNER" } } as any)
    vi.mocked(prisma.physicalInventory.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.receiptLine.findMany).mockResolvedValue([])
  })

  it("returns the primary supplier or the active alternatives for each product", async () => {
    const countedAt = new Date("2026-10-01T00:00:00.000Z")
    const alternatives = [
      { isPrimary: false, supplier: { legalName: "Proveedor A" } },
      { isPrimary: false, supplier: { legalName: "Proveedor B" } },
    ]
    const inventory = {
      id: "inventory-1",
      countedAt,
      createdById: "partner-1",
      notes: null,
      createdAt: countedAt,
      updatedAt: countedAt,
      lines: [
        inventoryLine("product-1", [
          alternatives[0],
          { isPrimary: true, supplier: { legalName: "Proveedor principal" } },
        ]),
        inventoryLine("product-2", alternatives),
        inventoryLine("product-3", []),
      ],
    }
    vi.mocked(prisma.physicalInventory.findUnique).mockResolvedValue(inventory)

    const response = await GET(
      new NextRequest("http://localhost/api/inventario/inventario-fisico/inventory-1/comparacion"),
      { params: Promise.resolve({ id: inventory.id }) },
    )

    expect(response.status).toBe(200)
    const { comparison } = await response.json()
    expect(comparison.map(({ product }: { product: unknown }) => product)).toEqual([
      { id: "product-1", baseStockUnit: "kg", supplierNames: ["Proveedor principal"] },
      { id: "product-2", baseStockUnit: "kg", supplierNames: ["Proveedor A", "Proveedor B"] },
      { id: "product-3", baseStockUnit: "kg", supplierNames: [] },
    ])
    expect(prisma.physicalInventory.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      include: {
        lines: {
          include: {
            product: {
              select: expect.objectContaining({
                suppliers: expect.objectContaining({ where: { active: true } }),
              }),
            },
          },
        },
      },
    }))
  })
})
