import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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
              transportCost: 1.5,
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
            transportCost: 1.5,
            notes: "Recepción inicial",
            supplier: { id: "supplier-1", legalName: "Proveedor prueba" },
            receivedBy: { name: "Admin" },
            lines: [{
              id: "line-1",
              receivedQuantity: 4,
              packageCount: 6,
              unitPrice: 2.5,
              batch: "LOT-1",
              dueDate: null,
              product: { id: "product-1", code: "MP-001", posDescription: "Harina", purchaseUnit: "SACO", isWeightBased: true, itemType: "MP", purchaseVatPercentage: 10, vatPercentage: null },
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

    await user.click(screen.getByRole("button", { name: "Ver" }))
    expect(await screen.findByText("Coste Unit. con IVA")).toBeInTheDocument()
    expect(screen.getAllByText("IVA 10%")).toHaveLength(2)
    expect(screen.getByText("Desglose por IVA")).toBeInTheDocument()
    expect(screen.getByText("Cuota")).toBeInTheDocument()
    expect(screen.getByText("Subtotal sin IVA")).toBeInTheDocument()
    expect(screen.getByText("Bandejas / elementos")).toBeInTheDocument()
    expect(screen.getByText("Bandejas / elementos: 6")).toBeInTheDocument()
    expect(screen.queryByText("Precio Unit.")).not.toBeInTheDocument()
    expect(screen.getAllByText("11.00 €")).toHaveLength(3)
    expect(screen.getAllByText("10.00 €")).toHaveLength(3)
    expect(screen.getByText("Productos sin IVA:")).toBeInTheDocument()
    expect(screen.getByText("Transporte:")).toBeInTheDocument()
    expect(screen.getByText("1.50 €")).toBeInTheDocument()
    expect(screen.getByText("Total albarán:")).toBeInTheDocument()
    expect(screen.getByText("12.50 €")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Volver" }))

    await screen.findByText("ALB-001")
    await user.click(screen.getByRole("button", { name: "Modificar" }))

    expect(await screen.findByRole("heading", { name: "Modificar recepción" })).toBeInTheDocument()
    expect(screen.getByDisplayValue("ALB-001")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Recepción inicial")).toBeInTheDocument()
  })

  it("shows a generic item in the saved receipt and keeps its fields when editing", async () => {
    const user = userEvent.setup()
    const receipt = {
      id: "receipt-1",
      deliveryNoteCode: "ALB-HALLOWEEN",
      receivedAt: "2026-10-01T00:00:00.000Z",
      transportCost: 0,
      notes: null,
      supplier: { id: "supplier-1", legalName: "Proveedor prueba" },
      receivedBy: { name: "Socio" },
      _count: { lines: 1 },
      lines: [{
        id: "line-1",
        productId: null,
        product: null,
        genericDescription: "Decoración de Halloween",
        genericVatPercentage: "21",
        receivedQuantity: "2",
        packageCount: 1,
        unitPrice: "5",
      }],
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === "PATCH") return Response.json({ id: receipt.id })
      if (url.includes("/proveedores")) return Response.json({ suppliers: [receipt.supplier] })
      if (url.includes("/recepciones/productos")) return Response.json({ products: [] })
      if (url.endsWith(`/recepciones/${receipt.id}`)) return Response.json(receipt)
      return Response.json({ receipts: [receipt], total: 1 })
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<ReceiptsPanel canEdit />)
    await user.click(await screen.findByRole("button", { name: "Ver" }))
    const row = await screen.findByRole("row", { name: /Decoración de Halloween/ })
    expect(within(row).getByRole("cell", { name: "PRODUCTO GENÉRICO" })).toBeInTheDocument()
    expect(within(row).getByRole("cell", { name: "IVA 21%" })).toBeInTheDocument()
    expect(within(row).getByRole("cell", { name: "12.10 €" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Modificar" }))
    expect(screen.getByDisplayValue("PRODUCTO GENÉRICO")).toBeInTheDocument()
    expect(screen.getByLabelText("IVA del producto genérico (%) *")).toHaveValue(21)
    const description = screen.getByLabelText("Descripción del producto genérico *")
    expect(description).toHaveValue("Decoración de Halloween")
    await user.clear(description)
    await user.type(description, "Guirnaldas")
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/inventario/recepciones/receipt-1",
      expect.objectContaining({ method: "PATCH" }),
    ))
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")?.[1]
    expect(JSON.parse(String(patch?.body))).toMatchObject({
      lines: [{ productId: null, genericDescription: "Guirnaldas", genericVatPercentage: 21, receivedQuantity: 2, unitPrice: 5 }],
    })
  })
})

describe("ReceiptsPanel linked reception permissions", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith("/api/inventario/proveedores")) return { ok: true, json: async () => ({ suppliers: [] }) }
      return {
        ok: true,
        json: async () => ({
          receipts: [{
            id: "receipt-1",
            deliveryNoteCode: "ALB-1",
            receivedAt: "2026-08-01T00:00:00.000Z",
            transportCost: 0,
            notes: null,
            supplier: { legalName: "Proveedor Uno" },
            receivedBy: { name: "Empleado" },
            invoice: { id: "invoice-1", series: "A", number: "42", workflowStatus: "DRAFT", accountingInvoice: { id: "capture-1", reconciliationStatus: "LINKED" } },
            _count: { lines: 1 },
          }],
          total: 1,
        }),
      }
    }))
  })

  it("hides edit and delete actions for a linked reception", async () => {
    render(<ReceiptsPanel canEdit canDelete />)

    expect(await screen.findByText("ALB-1")).toBeInTheDocument()
    expect(screen.getByText(/Factura vinculada/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Modificar" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument()
  })
})
