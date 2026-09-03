import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    catalog: {
      findFirst: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { GET, POST } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

function mockRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/inventario/productos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

function mockGetRequest() {
  return new Request("http://localhost/api/inventario/productos?page=1&pageSize=50") as unknown as NextRequest
}

describe("POST /api/inventario/productos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } } as any)
  })

  it("requires confirmation when possible duplicates are found", async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
      { id: "existing-1", code: "MP-HAR-001", posDescription: "Harina", fullDescription: "Harina trigo", eanBarcode: null, itemType: "MP", family: "Harinas y sémolas", status: "Activo" },
    ] as any)

    const response = await POST(mockRequest({
      itemType: "MP",
      family: "Harinas y sémolas",
      posDescription: "Harina",
      fullDescription: "Harina trigo",
    }))

    expect(response.status).toBe(409)
    expect(prisma.catalog.findFirst).not.toHaveBeenCalled()
  })

  it("generates the code and derives flags on the server", async () => {
    vi.mocked(prisma.product.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    vi.mocked(prisma.catalog.findFirst)
      .mockResolvedValueOnce({ value: "MP" } as any)
      .mockResolvedValueOnce({ value: "Harinas y sémolas", codePrefix: "HAR" } as any)
    vi.mocked(prisma.product.create).mockResolvedValue({ code: "MP-HAR-001" } as any)

    const response = await POST(mockRequest({
      itemType: "mp",
      family: "Harinas y sémolas",
      posDescription: "Harina nueva",
      fullDescription: "Harina nueva saco",
      baseUnitCost: 10,
      purchaseVatPercentage: 21,
      salesVatPercentage: 10,
      pricingMethod: "FIJO",
      targetMarginPercentage: 70,
      appliedRetailPriceIncludingVat: 20,
      isPurchasable: false,
      isPrepared: true,
      isSellable: true,
      hasRecipe: true,
      confirmDuplicate: true,
    }))

    expect(response.status).toBe(201)
    expect(prisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: "MP-HAR-001",
        itemType: "MP",
        isPurchasable: true,
        isPrepared: false,
        isSellable: false,
        hasRecipe: false,
        vatPercentage: 10,
        purchaseVatPercentage: 21,
        salesVatPercentage: 10,
        costIncludingVat: 12.1,
        targetRetailPriceIncludingVat: 36.6667,
        fixedRetailPriceIncludingVat: 20,
        appliedRetailPriceIncludingVat: 20,
        appliedRetailPriceExcludingVat: 18.1818,
        profitPerUnit: 8.1818,
        actualMarginPercentage: 45,
        percentagePointDeviation: -25,
        unitDifference: -16.6667,
        pricingDiagnosis: "MUY POR DEBAJO",
        createdById: "user-1",
      }),
    })
    const createCall = vi.mocked(prisma.product.create).mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(createCall.data).not.toHaveProperty("confirmarDuplicado")
  })
})

describe("GET /api/inventario/productos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } } as any)
  })

  it("loads only the principal provider for the product table", async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        id: "product-1",
        code: "PT-SLD-002",
        suppliers: [{ isPrimary: true, supplier: { id: "provider-1", legalName: "Proveedor principal" } }],
      },
    ] as any)
    vi.mocked(prisma.product.count).mockResolvedValue(1)

    const response = await GET(mockGetRequest())

    expect(response.status).toBe(200)
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: {
        suppliers: {
          where: { isPrimary: true },
          include: { supplier: { select: { id: true, legalName: true } } },
          take: 1,
        },
      },
    }))
    await expect(response.json()).resolves.toMatchObject({
      products: [{ code: "PT-SLD-002", suppliers: [{ supplier: { legalName: "Proveedor principal" } }] }],
      total: 1,
    })
  })
})
