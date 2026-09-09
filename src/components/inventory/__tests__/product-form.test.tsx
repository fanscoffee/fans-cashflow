import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import ProductForm from "../product-form"

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderEdit() {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })))

  return render(
    <ProductForm
      initialValues={{
        id: "product-1",
        code: "MP-HAR-001",
        itemType: "MP",
        family: "Harinas y sémolas",
        pricingMethod: "FIJO",
        targetMarginPercentage: 70,
        baseUnitCost: 10,
        baseStockUnit: "kg",
        purchaseUnit: "caja",
        purchaseToBaseFactor: 20,
        salesUnit: "caja",
        vatPercentage: 10,
        purchaseVatPercentage: 21,
        salesVatPercentage: 10,
        appliedRetailPriceIncludingVat: 20,
      } as any}
      onSubmit={vi.fn().mockResolvedValue(true)}
      onCancel={vi.fn()}
      saving={false}
    />,
  )
}

function renderClassificationEdit(onSubmit: (data: Record<string, unknown>) => Promise<boolean>) {
  const catalogs: Record<string, unknown[]> = {
    SUBFAMILIA: [{ id: "subfamily-1", type: "SUBFAMILIA", value: "Nueva subfamilia", description: null }],
    SECCION: [{ id: "section-1", type: "SECCION", value: "Nueva sección", description: null }],
    UNIDAD_MEDIDA: [
      { id: "unit-kg", type: "UNIDAD_MEDIDA", value: "kg", description: "Kilogramos" },
      { id: "unit-box", type: "UNIDAD_MEDIDA", value: "caja", description: "Cajas" },
      { id: "unit-each", type: "UNIDAD_MEDIDA", value: "ud", description: "Unidades" },
    ],
  }
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const type = new URL(String(input), "http://localhost").searchParams.get("type") || ""
    return Promise.resolve({ ok: true, json: async () => catalogs[type] || [] })
  }))

  return render(
    <ProductForm
      initialValues={{
        id: "product-1",
        code: "MP-HAR-001",
        itemType: "MP",
        family: "Harinas y sémolas",
        subfamily: "Antigua",
        section: "General",
        posDescription: "Harina",
        fullDescription: "Harina de trigo",
        baseStockUnit: "KG",
        vatCode: "GENERAL",
        pricingMethod: "FIJO",
        stockControl: "SI",
        valuationMethod: "PMP",
        batchControl: "NO",
        status: "Activo",
      } as any}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
      saving={false}
    />,
  )
}

describe("ProductForm pricing calculations", () => {
  it("updates calculated values as pricing inputs change", async () => {
    const user = userEvent.setup()
    renderEdit()

    await user.click(screen.getByRole("button", { name: "Costes" }))
    await user.click(screen.getByRole("button", { name: "Fiscal y precios" }))

    expect(screen.getByDisplayValue("12.10")).toBeInTheDocument()
    expect(screen.getByLabelText("PVP unitario sin IVA (€)")).toHaveValue("0.50")
    expect(screen.getByDisplayValue("18.18")).toBeInTheDocument()
    expect(screen.getByDisplayValue("17.68")).toBeInTheDocument()
    expect(screen.getByDisplayValue("97.25")).toBeInTheDocument()

    const salesVat = document.querySelector('input[name="salesVatPercentage"]') as HTMLInputElement
    await user.clear(salesVat)
    await user.type(salesVat, "20")

    await waitFor(() => {
      expect(screen.getByDisplayValue("16.67")).toBeInTheDocument()
      expect(screen.getByDisplayValue("16.17")).toBeInTheDocument()
      expect(screen.getAllByDisplayValue("97.00").length).toBeGreaterThan(0)
    })
  })

  it("leaves only the sale price as an editable PVP field", async () => {
    const user = userEvent.setup()
    renderEdit()

    await user.click(screen.getByRole("button", { name: "Fiscal y precios" }))

    expect(document.querySelector('input[name="targetRetailPriceIncludingVat"]')).toBeNull()
    expect(document.querySelector('input[name="fixedRetailPriceIncludingVat"]')).toBeNull()
    expect(document.querySelector('input[name="appliedRetailPriceIncludingVat"]')).toBeInTheDocument()
  })

  it("shows the existing type and family while editing", async () => {
    const user = userEvent.setup()
    renderEdit()

    await user.click(screen.getByRole("button", { name: "Clasificación" }))

    await waitFor(() => {
      expect(screen.getByLabelText("Tipo de artículo *")).toHaveValue("MP")
      expect(screen.getByLabelText("Familia *")).toHaveValue("Harinas y sémolas")
    })
  })

  it("submits changed subfamily and section values", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async (data: Record<string, unknown>) => {
      void data
      return true
    })
    renderClassificationEdit(onSubmit)

    await user.click(screen.getByRole("button", { name: "Clasificación" }))
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Nueva subfamilia" })).toBeInTheDocument()
      expect(screen.getByRole("option", { name: "Nueva sección" })).toBeInTheDocument()
    })
    await user.selectOptions(screen.getByLabelText("Subfamilia"), "Nueva subfamilia")
    await user.selectOptions(screen.getByLabelText("Sección *"), "Nueva sección")
    await user.click(screen.getByRole("button", { name: "Unidades de medida" }))
    expect(screen.getByLabelText("UM base stock *")).toHaveValue("KG")
    await user.selectOptions(screen.getByLabelText("UM base stock *"), "kg")
    await user.selectOptions(screen.getByLabelText("UM compra"), "caja")
    await user.selectOptions(screen.getByLabelText("UM venta"), "ud")
    await user.click(screen.getByRole("button", { name: "Actualizar" }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      subfamily: "Nueva subfamilia",
      section: "Nueva sección",
      baseStockUnit: "kg",
      purchaseUnit: "caja",
      salesUnit: "ud",
    })
  })
})
