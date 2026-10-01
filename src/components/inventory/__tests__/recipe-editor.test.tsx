import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import RecipeEditor from "../recipe-editor"

afterEach(() => vi.unstubAllGlobals())

const catalogs = {
  FAMILIA: [{ id: "family-1", type: "FAMILIA", value: "Salados", codePrefix: "SLD" }],
  SUBFAMILIA: [],
  SECCION: [{ id: "section-1", type: "SECCION", value: "Cafetería" }],
  UNIDAD_MEDIDA: [{ id: "unit-1", type: "UNIDAD_MEDIDA", value: "ud" }],
  CODIGO_IVA: [{ id: "vat-1", type: "CODIGO_IVA", value: "RD10" }],
  VALORACION: [{ id: "valuation-1", type: "VALORACION", value: "PMP" }],
  UBICACION: [],
  SI_NO: [{ id: "no-1", type: "SI_NO", value: "NO" }, { id: "yes-1", type: "SI_NO", value: "SI" }],
  CONSERVACION: [],
}

describe("RecipeEditor", () => {
  it("creates recipe and output product from the same form", async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn().mockResolvedValue(undefined)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: 1, recipe: { product: { code: "PT-SLD-001" } } }),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(
      <RecipeEditor
        products={[{ id: "component-1", code: "MP-LAC-001", posDescription: "Queso", baseStockUnit: "kg", status: "Activo", stockControl: "SI" }]}
        catalogs={catalogs}
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    )

    expect(screen.queryByText("Producto elaborado")).not.toBeInTheDocument()
    await user.type(screen.getByLabelText("Nombre TPV *"), "Croissant jamón y queso")
    await user.type(screen.getByLabelText("Descripción completa *"), "Croissant relleno de jamón y queso")
    await user.selectOptions(screen.getByLabelText("Familia *"), "Salados")
    await user.selectOptions(screen.getByLabelText("Sección *"), "Cafetería")
    await user.selectOptions(screen.getByLabelText("Código IVA *"), "RD10")
    await user.type(screen.getByLabelText("IVA venta *"), "10")
    await user.type(screen.getByLabelText("Precio venta con IVA *"), "3,30")
    await user.selectOptions(screen.getByLabelText("Componente 1"), "component-1")
    await user.type(screen.getByLabelText("Cantidad componente 1"), "1")
    await user.click(screen.getByRole("button", { name: "Crear y activar" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const request = fetchMock.mock.calls[0]
    const payload = JSON.parse(request[1].body)
    expect(payload).toMatchObject({
      mode: "NEW_RECIPE",
      activate: true,
      product: {
        posDescription: "Croissant jamón y queso",
        itemType: "PT",
        family: "Salados",
        salePriceIncludingVat: 3.3,
      },
      components: [{ componentProductId: "component-1", quantityPerUnit: 1 }],
    })
    expect(screen.getByLabelText("Componente 1")).toHaveClass("text-gray-900")
    expect(onSaved).toHaveBeenCalledWith("Receta y producto PT-SLD-001 creados y activados")
  })

  it("calculates the cost of one produced unit from three component quantities", async () => {
    const products = [
      { id: "component-1", code: "MP-LAC-001", posDescription: "Queso", baseStockUnit: "kg", status: "Activo", stockControl: "SI", baseUnitCost: 20, purchaseToBaseFactor: null },
      { id: "component-2", code: "MP-CAR-001", posDescription: "Jamón", baseStockUnit: "kg", status: "Activo", stockControl: "SI", baseUnitCost: 10, purchaseToBaseFactor: null },
      { id: "component-3", code: "MP-HAR-001", posDescription: "Harina", baseStockUnit: "kg", status: "Activo", stockControl: "SI", baseUnitCost: 4, purchaseToBaseFactor: null },
    ]

    render(<RecipeEditor products={products} catalogs={catalogs} onCancel={vi.fn()} onSaved={vi.fn().mockResolvedValue(undefined)} />)

    await userEvent.selectOptions(screen.getByLabelText("Componente 1"), "component-1")
    await userEvent.type(screen.getByLabelText("Cantidad componente 1"), "0,04")
    await userEvent.click(screen.getByRole("button", { name: "+ Añadir componente" }))
    await userEvent.selectOptions(screen.getByLabelText("Componente 2"), "component-2")
    await userEvent.type(screen.getByLabelText("Cantidad componente 2"), "0,03")
    await userEvent.click(screen.getByRole("button", { name: "+ Añadir componente" }))
    await userEvent.selectOptions(screen.getByLabelText("Componente 3"), "component-3")
    await userEvent.type(screen.getByLabelText("Cantidad componente 3"), "0,10")

    expect(screen.getByText("Coste total de una unidad producida").parentElement).toHaveTextContent("1.5000 €")
    const lineCosts = screen.getAllByText(/Coste unitario:/)
    expect(lineCosts).toHaveLength(3)
    expect(lineCosts[0]).toHaveTextContent("Coste de esta cantidad: 0.8000 €")
    expect(lineCosts[1]).toHaveTextContent("Coste de esta cantidad: 0.3000 €")
    expect(lineCosts[2]).toHaveTextContent("Coste de esta cantidad: 0.4000 €")
  })
})
