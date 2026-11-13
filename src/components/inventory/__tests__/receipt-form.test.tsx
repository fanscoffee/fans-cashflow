import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
vi.mock("@/lib/document-ocr", () => ({ extractDocument: vi.fn() }))
import ReceiptForm from "../receipt-form"
import { extractDocument } from "@/lib/document-ocr"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ReceiptForm provider products", () => {
  it("loads products only for the selected provider and clears them when it changes", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/api/inventario/proveedores")) {
        return Promise.resolve({ ok: true, json: async () => ({ suppliers: [{ id: "provider-1", legalName: "Proveedor 1" }, { id: "provider-2", legalName: "Proveedor 2" }] }) })
      }
      if (url.includes("supplierId=provider-1")) {
        return Promise.resolve({ ok: true, json: async () => ({ products: [{ id: "product-1", code: "P-001", posDescription: "Producto 1", purchaseUnit: "UD", baseUnitCost: 2, purchaseVatPercentage: null, vatPercentage: 10 }] }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ products: [{ id: "product-2", code: "P-002", posDescription: "Producto 2", purchaseUnit: "UD", baseUnitCost: 3 }] }) })
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<ReceiptForm onSubmit={vi.fn().mockResolvedValue(undefined)} onCancel={vi.fn()} saving={false} />)

    expect(screen.getByLabelText("Coste unitario sin IVA")).toBeInTheDocument()
    expect(screen.queryByLabelText("Precio unitario")).not.toBeInTheDocument()

    const providerSelect = screen.getByLabelText("Proveedor *")
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/api/inventario/recepciones/productos"), expect.anything())

    await screen.findByRole("option", { name: "Proveedor 1" })
    await user.selectOptions(providerSelect, "provider-1")
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/inventario/recepciones/productos?supplierId=provider-1",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    })

    await user.click(await screen.findByPlaceholderText("Buscar producto..."))
    expect(screen.getByRole("button", { name: /P-001 Producto 1/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /P-002 Producto 2/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /P-001 Producto 1/ }))
    expect(screen.getByDisplayValue("P-001 - Producto 1")).toBeInTheDocument()
    expect(screen.getByLabelText("Coste unitario sin IVA")).toHaveValue(2)
    expect(screen.getByText("Coste unitario con IVA")).toBeInTheDocument()
    expect(screen.getByText("2.2000 EUR")).toBeInTheDocument()
    expect(screen.getByText("Subtotal sin IVA")).toBeInTheDocument()
    expect(screen.getByText("2.00 EUR")).toBeInTheDocument()
    expect(screen.getByText("Productos con IVA: 2.20 EUR")).toBeInTheDocument()
    expect(screen.getByText("Total albarán: 2.20 EUR")).toBeInTheDocument()

    const transportInput = screen.getByLabelText("Importe de transporte/preparación sin IVA")
    await user.clear(transportInput)
    await user.type(transportInput, "1.50")
    expect(screen.getByText("Transporte/preparación sin IVA: 1.5000 EUR")).toBeInTheDocument()
    expect(screen.getByText("Total albarán: 3.70 EUR")).toBeInTheDocument()

    await user.selectOptions(providerSelect, "provider-2")
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/inventario/recepciones/productos?supplierId=provider-2",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    })
    expect(screen.getByPlaceholderText("Buscar producto...")).toHaveValue("")
    await user.click(screen.getByPlaceholderText("Buscar producto..."))
    expect(screen.getByRole("button", { name: /P-002 Producto 2/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /P-001 Producto 1/ })).not.toBeInTheDocument()
  })

  it("prefills a Mercadona delivery note from an OCR document and maps catalog products", async () => {
    const user = userEvent.setup()
    vi.mocked(extractDocument).mockResolvedValue(`
      Pedido Nº 33532404
      Cobrado el 05/10/26 a las 07:22
      Nombre Producto Cantidad entregada PVP
      Tomates 22 92,40 €
      Productos 92,40 €
      Coste de preparación 8,20 €
      TOTAL 100,60 €
      Desglose de impuestos
      IVA Base Cuota
      21% 6,78 € 1,42 €
      4% 88,85 € 3,55 €
      Total 95,63 € 4,97 €
      MERCADONA.S.A | A-46103834
    `)
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/api/inventario/proveedores")) {
        return Promise.resolve({ ok: true, json: async () => ({ suppliers: [{ id: "mercadona", legalName: "MERCADONA S.A.", taxId: "A46103834" }] }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ products: [{ id: "tomato", code: "TOM-1", posDescription: "Tomates", purchaseUnit: "KG", baseUnitCost: 3, purchaseVatPercentage: 4, vatPercentage: 4 }] }) })
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<ReceiptForm onSubmit={vi.fn().mockResolvedValue(undefined)} onCancel={vi.fn()} saving={false} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, new File(["albarán"], "albaran.jpg", { type: "image/jpeg" }))

    await waitFor(() => expect(screen.getByDisplayValue("33532404")).toBeInTheDocument())
    await waitFor(() => expect(screen.getByDisplayValue("TOM-1 - Tomates")).toBeInTheDocument())
    expect(screen.getByDisplayValue("22")).toBeInTheDocument()
    expect(screen.getByLabelText("Coste unitario sin IVA")).toHaveValue(4.0385)
    expect(screen.getByText("4.00%")).toBeInTheDocument()
    expect(screen.getByText("El desglose de IVA coincide con las bases y cuotas del albarán.")).toBeInTheDocument()
    expect(screen.getByText("Todas las líneas se asociaron automáticamente al catálogo del proveedor.")).toBeInTheDocument()
    expect(screen.getByText("Transporte/preparación sin IVA: 6.7769 EUR")).toBeInTheDocument()
    expect(screen.getByText("PVP preparación bruto: 8.20 EUR")).toBeInTheDocument()
  })
})
