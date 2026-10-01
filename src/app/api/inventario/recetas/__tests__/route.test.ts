import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const createRecipeWithProduct = vi.hoisted(() => vi.fn())
const createRecipeVersion = vi.hoisted(() => vi.fn())

vi.mock("@/lib/recipe-control", () => ({ createRecipeWithProduct, createRecipeVersion }))
vi.mock("@/lib/prisma", () => ({ prisma: { recipe: { findMany: vi.fn() } } }))
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))

import { POST } from "../route"
import { auth } from "@/lib/auth"

describe("POST /api/inventario/recetas", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    createRecipeWithProduct.mockResolvedValue({ id: "version-1", recipe: { product: { code: "PT-SLD-001" } } })
  })

  it("creates product output and recipe from one request", async () => {
    const body = {
      mode: "NEW_RECIPE",
      product: {
        posDescription: "Croissant jamón y queso",
        fullDescription: "Croissant relleno de jamón y queso",
        itemType: "PT",
        family: "Salados",
        section: "Cafetería",
        baseStockUnit: "ud",
        salesUnit: "ud",
        salesToBaseFactor: 1,
        vatCode: "RD10",
        salesVatPercentage: "10",
        salePriceIncludingVat: "3,30",
        valuationMethod: "PMP",
        batchControl: "NO",
      },
      tolerancePercentage: 5,
      components: [{ componentProductId: "component-1", quantityPerUnit: "1,00" }],
    }
    const response = await POST(new Request("http://localhost/api/inventario/recetas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as unknown as NextRequest)

    expect(response.status).toBe(201)
    expect(createRecipeWithProduct).toHaveBeenCalledWith(
      { id: "admin-1", role: "ADMIN" },
      expect.objectContaining({
        mode: "NEW_RECIPE",
        product: expect.objectContaining({ itemType: "PT", salesVatPercentage: 10, salePriceIncludingVat: 3.3 }),
      }),
    )
    expect(createRecipeVersion).not.toHaveBeenCalled()
  })

  it("rejects incomplete product output before domain writes", async () => {
    const response = await POST(new Request("http://localhost/api/inventario/recetas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "NEW_RECIPE", product: {}, components: [] }),
    }) as unknown as NextRequest)

    expect(response.status).toBe(400)
    expect(createRecipeWithProduct).not.toHaveBeenCalled()
  })
})
