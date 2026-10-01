import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import RecipeManager from "../recipe-manager"

afterEach(() => vi.unstubAllGlobals())

describe("RecipeManager", () => {
  it("renders recipes in the standard inventory table layout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith("/api/inventario/recetas")) {
        return {
          ok: true,
          json: async () => [{
            id: "recipe-1",
            product: {
              id: "product-1",
              code: "PT-SLD-001",
              posDescription: "Croissant jamón y queso",
              baseStockUnit: "ud",
              fixedRetailPriceIncludingVat: 3.3,
              appliedRetailPriceIncludingVat: 3.3,
              salesVatPercentage: 10,
            },
            versions: [{
              id: "version-1",
              version: 1,
              status: "ACTIVE",
              tolerancePercentage: 5,
              calculatedUnitCost: 1.5,
              costCalculatedAt: "2026-10-01T00:00:00.000Z",
              components: [],
            }],
          }],
        }
      }
      if (url.startsWith("/api/inventario/productos")) return { ok: true, json: async () => ({ products: [], total: 0 }) }
      return { ok: true, json: async () => [] }
    }))

    render(<RecipeManager />)

    const table = await screen.findByRole("table")
    expect(Array.from(table.querySelectorAll("th")).map((header) => header.textContent)).toEqual([
      "Nombre",
      "Coste",
      "Precio",
      "Margen",
      "Acciones",
    ])
    expect(screen.getByText("Croissant jamón y queso")).toBeInTheDocument()
    expect(screen.getByText("1.5000 €")).toBeInTheDocument()
    expect(screen.getByText("3.30 €")).toBeInTheDocument()
    expect(screen.getByText("50.00 %")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument()
  })
})
