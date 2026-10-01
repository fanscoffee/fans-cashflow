import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import PhysicalInventoryPanel from "../physical-inventory-panel"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}))

import { useSession } from "next-auth/react"

const products = [
  { id: "product-1", code: "MP-HAR-001", posDescription: "Harina", fullDescription: "Harina de trigo", purchaseUnit: "SACO", baseStockUnit: "kg", purchaseToBaseFactor: 25 },
  { id: "product-2", code: "MP-LAC-001", posDescription: "Queso", fullDescription: "Queso curado", purchaseUnit: "KG", baseStockUnit: "kg", purchaseToBaseFactor: 1 },
  { id: "product-3", code: "MP-AZU-001", posDescription: "Azúcar", fullDescription: "Azúcar blanquilla", purchaseUnit: "KG", baseStockUnit: "kg", purchaseToBaseFactor: 1 },
]

afterEach(() => vi.unstubAllGlobals())

describe("PhysicalInventoryPanel", () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { role: "ADMIN" } } } as any)
  })

  it("allows editing a saved inventory and filtering products by name", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === "PATCH") return { ok: true, json: async () => ({ id: "inventory-1" }) }
      if (url.includes("/comparacion")) return {
        ok: true,
        json: async () => ({
          inventory: { id: "inventory-1", countedAt: "2026-10-01T00:00:00.000Z", notes: "Conteo mensual" },
          previousInventory: null,
          comparison: [],
        }),
      }
      if (url.endsWith("/inventory-1")) return {
        ok: true,
        json: async () => ({
          id: "inventory-1",
          countedAt: "2026-10-01T00:00:00.000Z",
          notes: "Conteo mensual",
          createdBy: { name: "Admin" },
          lines: [{ productId: "product-1", quantityUnit1: 2, quantityUnit2: 50 }],
        }),
      }
      if (url.includes("/productos")) return { ok: true, json: async () => ({ products }) }
      return {
        ok: true,
        json: async () => ({
          inventories: [{ id: "inventory-1", countedAt: "2026-10-01T00:00:00.000Z", notes: "Conteo mensual", createdBy: { name: "Admin" }, _count: { lines: 1 } }],
          total: 1,
        }),
      }
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<PhysicalInventoryPanel />)
    await screen.findByText("Conteo mensual")
    await user.click(screen.getByRole("button", { name: "Modificar" }))
    await screen.findByRole("heading", { name: "Modificar inventario" })

    expect(screen.getByLabelText("Cantidad base MP-HAR-001")).toHaveValue(50)
    expect(screen.getByText("Queso")).toBeInTheDocument()

    const searchInput = screen.getByLabelText("Buscar producto por nombre o código")
    await user.type(searchInput, "trigo")

    expect(screen.getByText("Harina")).toBeInTheDocument()
    expect(screen.queryByText("Queso")).not.toBeInTheDocument()
    expect(screen.queryByText("Azúcar")).not.toBeInTheDocument()

    await user.clear(searchInput)
    await user.type(searchInput, "azucar")

    expect(screen.getByText("Azúcar")).toBeInTheDocument()
    expect(screen.queryByText("Harina")).not.toBeInTheDocument()

    await user.clear(searchInput)

    await user.clear(screen.getByLabelText("Cantidad base MP-HAR-001"))
    await user.type(screen.getByLabelText("Cantidad base MP-HAR-001"), "55")
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/inventario/inventario-fisico/inventory-1",
      expect.objectContaining({ method: "PATCH" }),
    ))
    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      lines: expect.arrayContaining([{ productId: "product-1", quantityUnit1: 2, quantityUnit2: 55 }]),
    })
  })
})
