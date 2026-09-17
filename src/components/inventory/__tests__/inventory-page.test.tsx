import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import InventoryPage from "../inventory-page"

const product = {
  id: "product-1",
  code: "IN-001",
  posDescription: "Producto prueba",
  itemType: "IN",
  family: "Cafetería",
  status: "Activo",
  abcClass: "A",
  baseUnitCost: 12.345,
  baseStockUnit: "UD",
  vatCode: "GENERAL",
  actualMarginPercentage: 42.5,
  targetMarginPercentage: 55,
  appliedRetailPriceIncludingVat: 19.99,
  suppliers: [
    {
      id: "relation-1",
      supplierId: "supplier-1",
      supplier: { id: "supplier-1", legalName: "Proveedor prueba" },
      isPrimary: true,
    },
  ],
}

function mockProductsRequest(productTotal = 1) {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.startsWith("/api/inventario/proveedores")) {
      return {
        ok: true,
        json: async () => ({
          suppliers: [{ id: "supplier-1", legalName: "Proveedor prueba" }],
          total: 1,
        }),
      }
    }
    return {
      ok: true,
      json: async () => ({ products: [product], total: productTotal }),
    }
  }))
}

async function renderInventory() {
  render(<InventoryPage />)
  await screen.findByText("Producto prueba")
}

function tableHeaders() {
  return within(screen.getByRole("table"))
    .getAllByRole("columnheader")
    .map((header) => header.textContent)
}

describe("InventoryPage column visibility", () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockProductsRequest()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("keeps the existing columns as the default view", async () => {
    await renderInventory()

    expect(screen.getByRole("button", { name: "Mostrar columnas" })).toBeInTheDocument()
    expect(tableHeaders()).toEqual([
      "Código",
      "Descripción",
      "Tipo",
      "Familia",
      "Proveedor",
      "Estado",
      "Clase",
      "Acciones",
    ])
  })

  it("replaces the class filter and requests products for the selected supplier", async () => {
    const user = userEvent.setup()
    await renderInventory()
    const supplierFilter = screen.getByRole("combobox", { name: "Filtrar por proveedor" })
    const searchInput = screen.getByPlaceholderText("Buscar por código o descripción...")
    const filterRow = searchInput.parentElement

    expect(filterRow).toContainElement(supplierFilter)
    expect(filterRow).toHaveClass("grid-cols-1", "sm:flex", "sm:flex-wrap", "lg:grid", "lg:grid-cols-6")
    expect(searchInput).toHaveClass("lg:col-span-2")
    expect(within(supplierFilter).getByRole("option", { name: "Todos los proveedores" })).toBeInTheDocument()
    expect(await within(supplierFilter).findByRole("option", { name: "Proveedor prueba" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Clase A" })).not.toBeInTheDocument()

    await user.selectOptions(supplierFilter, "supplier-1")

    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.some(([input]) => (
        String(input).includes("supplierId=supplier-1")
      ))).toBe(true)
    })
  })

  it("renders pagination controls with dark gray text and borders", async () => {
    mockProductsRequest(51)
    await renderInventory()

    for (const name of ["Anterior", "Siguiente"]) {
      expect(screen.getByRole("button", { name })).toHaveClass(
        "border-gray-600",
        "text-gray-800",
      )
    }
  })

  it("shows every column option vertically and locks description", async () => {
    const user = userEvent.setup()
    await renderInventory()

    await user.click(screen.getByRole("button", { name: "Mostrar columnas" }))

    const dialog = screen.getByRole("dialog", { name: "Mostrar columnas" })
    const checkboxes = within(dialog).getAllByRole("checkbox")
    expect(checkboxes).toHaveLength(13)
    expect(within(dialog).getByRole("checkbox", { name: "Descripción" })).toBeChecked()
    expect(within(dialog).getByRole("checkbox", { name: "Descripción" })).toBeDisabled()
    expect(within(dialog).getByRole("checkbox", { name: "Coste sin IVA" })).not.toBeChecked()
    expect(within(dialog).queryByRole("checkbox", { name: "Acciones" })).not.toBeInTheDocument()
    expect(checkboxes.every((checkbox) => checkbox.parentElement?.tagName === "LABEL")).toBe(true)
  })

  it("discards draft changes when cancelled", async () => {
    const user = userEvent.setup()
    await renderInventory()
    const showColumnsButton = screen.getByRole("button", { name: "Mostrar columnas" })

    await user.click(showColumnsButton)
    const dialog = screen.getByRole("dialog", { name: "Mostrar columnas" })
    await user.click(within(dialog).getByRole("checkbox", { name: "Código" }))
    await user.click(within(dialog).getByRole("checkbox", { name: "Coste sin IVA" }))
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(tableHeaders()).toContain("Código")
    expect(tableHeaders()).not.toContain("Coste sin IVA")
    expect(showColumnsButton).toHaveFocus()
  })

  it("applies optional columns, formats values, and saves the selection", async () => {
    const user = userEvent.setup()
    await renderInventory()

    await user.click(screen.getByRole("button", { name: "Mostrar columnas" }))
    const dialog = screen.getByRole("dialog", { name: "Mostrar columnas" })
    await user.click(within(dialog).getByRole("checkbox", { name: "Código" }))
    for (const label of [
      "Coste sin IVA",
      "Unidad",
      "Código IVA (compra)",
      "Margen real",
      "Margen objetivo %",
      "Precio de venta con IVA",
    ]) {
      await user.click(within(dialog).getByRole("checkbox", { name: label }))
    }
    await user.click(within(dialog).getByRole("button", { name: "Aplicar" }))

    const headers = tableHeaders()
    expect(headers).not.toContain("Código")
    expect(headers).toEqual(expect.arrayContaining([
      "Descripción",
      "Coste sin IVA",
      "Unidad",
      "Código IVA (compra)",
      "Margen real",
      "Margen objetivo %",
      "Precio de venta con IVA",
      "Acciones",
    ]))
    expect(screen.getByText((text) => text.includes("12,35") && text.includes("€"))).toBeInTheDocument()
    expect(screen.getByText("UD")).toBeInTheDocument()
    expect(screen.getByText("GENERAL")).toBeInTheDocument()
    expect(screen.getByText("42,50 %")).toBeInTheDocument()
    expect(screen.getByText("55,00 %")).toBeInTheDocument()
    expect(screen.getByText((text) => text.includes("19,99") && text.includes("€"))).toBeInTheDocument()

    const savedColumns = JSON.parse(
      window.localStorage.getItem("inventory-table-visible-columns") || "[]",
    )
    expect(savedColumns).toContain("description")
    expect(savedColumns).toContain("baseUnitCost")
    expect(savedColumns).not.toContain("code")
  })

  it("restores a saved selection while forcing description and actions visible", async () => {
    window.localStorage.setItem(
      "inventory-table-visible-columns",
      JSON.stringify(["baseUnitCost"]),
    )

    await renderInventory()

    expect(tableHeaders()).toEqual(["Descripción", "Coste sin IVA", "Acciones"])
  })

  it("closes with Escape or a backdrop click and returns focus", async () => {
    const user = userEvent.setup()
    await renderInventory()
    const showColumnsButton = screen.getByRole("button", { name: "Mostrar columnas" })

    await user.click(showColumnsButton)
    expect(screen.getByRole("button", { name: "Cerrar modal" })).toHaveFocus()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(showColumnsButton).toHaveFocus()

    await user.click(showColumnsButton)
    const backdrop = screen.getByRole("dialog", { name: "Mostrar columnas" }).parentElement
    expect(backdrop).not.toBeNull()
    fireEvent.mouseDown(backdrop as HTMLElement)
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(showColumnsButton).toHaveFocus()
  })
})
