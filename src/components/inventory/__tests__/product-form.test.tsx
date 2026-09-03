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

describe("ProductForm pricing calculations", () => {
  it("updates calculated values as pricing inputs change", async () => {
    const user = userEvent.setup()
    renderEdit()

    await user.click(screen.getByRole("button", { name: "Costes" }))
    await user.click(screen.getByRole("button", { name: "Fiscal y precios" }))

    expect(screen.getByDisplayValue("12.10")).toBeInTheDocument()
    expect(screen.getByDisplayValue("18.18")).toBeInTheDocument()
    expect(screen.getByDisplayValue("8.18")).toBeInTheDocument()
    expect(screen.getByDisplayValue("45.00")).toBeInTheDocument()

    const salesVat = document.querySelector('input[name="salesVatPercentage"]') as HTMLInputElement
    await user.clear(salesVat)
    await user.type(salesVat, "20")

    await waitFor(() => {
      expect(screen.getByDisplayValue("16.67")).toBeInTheDocument()
      expect(screen.getByDisplayValue("6.67")).toBeInTheDocument()
      expect(screen.getAllByDisplayValue("40.00").length).toBeGreaterThan(0)
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
})
