import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import SuppliersPanel from "../suppliers-panel"

const supplier = {
  id: "supplier-1",
  legalName: "Proveedor vinculado",
  taxId: "B12345678",
  serviceCategory: null,
  contactName: null,
  status: "Activo",
  reliabilityRating: null,
  _count: { products: 1 },
}

describe("SuppliersPanel", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("confirm", vi.fn(() => true))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows why a supplier was not deleted when the API returns a conflict", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ suppliers: [supplier], total: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: "No se puede eliminar el proveedor porque todavía tiene vinculaciones.",
        code: "PROVIDER_HAS_LINKS",
        links: { products: 2, receipts: 1, invoices: 0, creditors: 0 },
        details: { products: ["P-1 · Harina", "P-2 · Azúcar"], receipts: ["ALB-1"] },
      }), { status: 409 }))

    const user = userEvent.setup()
    render(<SuppliersPanel canDelete />)

    await user.click(await screen.findByRole("button", { name: "Eliminar" }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("No se ha eliminado el proveedor")
      expect(screen.getByRole("alert")).toHaveTextContent("2 productos, 1 recepción")
      expect(screen.getByRole("alert")).toHaveTextContent("productos: P-1 · Harina, P-2 · Azúcar")
      expect(screen.getByRole("alert")).toHaveTextContent("recepción: ALB-1")
    })
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument()
  })
})
