import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import ProductoForm from "../producto-form"

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderEdit() {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })))

  return render(
    <ProductoForm
      initialValues={{
        id: "product-1",
        codigo: "MP-HAR-001",
        tipoArticulo: "MP",
        familia: "Harinas y sémolas",
        metodoPrecio: "FIJO",
        margenObjetivoPct: 70,
        costeUmBase: 10,
        ivaPct: 10,
        ivaCompraPct: 21,
        ivaVentaPct: 10,
        pvpAplicadoConIva: 20,
      } as any}
      onSubmit={vi.fn().mockResolvedValue(true)}
      onCancel={vi.fn()}
      saving={false}
    />,
  )
}

describe("ProductoForm pricing calculations", () => {
  it("updates calculated values as pricing inputs change", async () => {
    const user = userEvent.setup()
    renderEdit()

    await user.click(screen.getByRole("button", { name: "Costes" }))
    await user.click(screen.getByRole("button", { name: "Fiscal y precios" }))

    expect(screen.getByDisplayValue("12.10")).toBeInTheDocument()
    expect(screen.getByDisplayValue("18.18")).toBeInTheDocument()
    expect(screen.getByDisplayValue("8.18")).toBeInTheDocument()
    expect(screen.getByDisplayValue("45.00")).toBeInTheDocument()

    const ivaVenta = document.querySelector('input[name="ivaVentaPct"]') as HTMLInputElement
    await user.clear(ivaVenta)
    await user.type(ivaVenta, "20")

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

    expect(document.querySelector('input[name="pvpObjetivoConIva"]')).toBeNull()
    expect(document.querySelector('input[name="pvpFijoConIva"]')).toBeNull()
    expect(document.querySelector('input[name="pvpAplicadoConIva"]')).toBeInTheDocument()
  })
})
