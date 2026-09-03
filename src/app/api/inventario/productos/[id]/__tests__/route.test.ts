import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
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
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      code: "MP-HAR-001",
      itemType: "MP",
      family: "Harinas y sémolas",
    } as any)

    const response = await PATCH(mockRequest({ code: "MP-HAR-002" }), context)

    expect(response.status).toBe(400)
    expect(prisma.product.update).not.toHaveBeenCalled()
  })

  it("derives flags when updating a standard product", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      code: "MP-HAR-001",
      itemType: "MP",
      family: "Harinas y sémolas",
      baseUnitCost: 10,
      vatPercentage: 10,
      purchaseVatPercentage: 21,
      salesVatPercentage: 10,
      pricingMethod: "FIJO",
      targetMarginPercentage: 70,
      fixedRetailPriceIncludingVat: 20,
      appliedRetailPriceIncludingVat: 20,
    } as any)
    vi.mocked(prisma.product.update).mockResolvedValue({ id: "product-1" } as any)

    const response = await PATCH(mockRequest({
      baseUnitCost: 10,
      purchaseVatPercentage: 21,
      salesVatPercentage: 10,
      appliedRetailPriceIncludingVat: 20,
      isPurchasable: false,
      isPrepared: true,
      isSellable: true,
      hasRecipe: true,
      notes: "Actualizado",
    }), context)

    expect(response.status).toBe(200)
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: "product-1" },
      data: {
        baseUnitCost: 10,
        purchaseVatPercentage: 21,
        salesVatPercentage: 10,
        isPurchasable: true,
        isPrepared: false,
        isSellable: false,
        hasRecipe: false,
        vatPercentage: 10,
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
        notes: "Actualizado",
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
    expect(prisma.product.delete).not.toHaveBeenCalled()
  })

  it("allows Yomi", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO", name: "yomi" } } as any)
    vi.mocked(prisma.product.delete).mockResolvedValue({ id: "product-1" } as any)

    const response = await DELETE(deleteRequest, context)

    expect(response.status).toBe(200)
    expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: "product-1" } })
  })

  it("allows ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.product.delete).mockResolvedValue({ id: "product-1" } as any)

    const response = await DELETE(deleteRequest, context)

    expect(response.status).toBe(200)
  })
})
