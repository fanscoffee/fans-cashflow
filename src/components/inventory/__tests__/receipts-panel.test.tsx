import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import ReceiptsPanel from "../receipts-panel"

afterEach(() => vi.unstubAllGlobals())

describe("ReceiptsPanel", () => {
  it("opens a saved reception in edit mode", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/inventario/recepciones?")) {
        return {
          ok: true,
          json: async () => ({
            receipts: [{
              id: "receipt-1",
              deliveryNoteCode: "ALB-001",
              receivedAt: "2026-10-01T00:00:00.000Z",
              notes: "Recepción inicial",
              supplier: { legalName: "Proveedor prueba" },
              receivedBy: { name: "Admin" },
              _count: { lines: 1 },
            }],
            total: 1,
          }),
        }
      }
      if (url.endsWith("/recepciones/receipt-1")) {
        return {
          ok: true,
          json: async () => ({
            id: "receipt-1",
            deliveryNoteCode: "ALB-001",
            receivedAt: "2026-10-01T00:00:00.000Z",
            notes: "Recepción inicial",
            supplier: { id: "supplier-1", legalName: "Proveedor prueba" },
            receivedBy: { name: "Admin" },
            lines: [{
              id: "line-1",
              receivedQuantity: 4,
              unitPrice: 2.5,
              batch: "LOT-1",
              dueDate: null,
              product: { id: "product-1", code: "MP-001", posDescription: "Harina", purchaseUnit: "SACO", itemType: "MP" },
            }],
          }),
        }
      }
      if (url.includes("/api/inventario/proveedores")) return { ok: true, json: async () => ({ suppliers: [] }) }
      if (url.includes("/api/inventario/recepciones/productos")) return { ok: true, json: async () => ({ products: [{ id: "product-1", code: "MP-001", posDescription: "Harina", purchaseUnit: "SACO", baseUnitCost: 2.5 }] }) }
      return { ok: true, json: async () => ({}) }
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<ReceiptsPanel canEdit />)
    await screen.findByText("ALB-001")
    await user.click(screen.getByRole("button", { name: "Modificar" }))

    expect(await screen.findByRole("heading", { name: "Modificar recepción" })).toBeInTheDocument()
    expect(screen.getByDisplayValue("ALB-001")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Recepción inicial")).toBeInTheDocument()
  })
})
