import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import AccountingInvoiceForm from "../accounting-invoice-form"
import { emptyAccountingInvoice } from "@/lib/accounting-invoices"

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderForm(initialValues = emptyAccountingInvoice()) {
  return render(
    <AccountingInvoiceForm
      initialValues={initialValues}
      onCancel={vi.fn()}
      onSubmit={vi.fn().mockResolvedValue(true)}
      saving={false}
    />
  )
}

describe("AccountingInvoiceForm", () => {
  it("calculates the VAT when a manual taxable base is entered", async () => {
    const user = userEvent.setup()
    renderForm()

    const base = screen.getByLabelText("Base 21%")
    await user.clear(base)
    await user.type(base, "100")

    expect(screen.getByLabelText("IVA 21%")).toHaveValue(21)
    expect(screen.getByLabelText("IVA 21%")).toHaveAttribute("readonly")
  })

  it("offers the accounting entity selector and defaults to Obrador", () => {
    renderForm()

    const entity = screen.getByLabelText("Entidad de la factura")
    expect(entity).toHaveValue("BAKERY")
    expect(screen.getByRole("option", { name: "Cafetería" })).toBeInTheDocument()
  })

  it("calculates the accounting totals from the tax breakdown and withholding", async () => {
    const user = userEvent.setup()
    renderForm()

    const base21 = screen.getByLabelText("Base 21%")
    await user.clear(base21)
    await user.type(base21, "100")

    const base10 = screen.getByLabelText("Base 10%")
    await user.clear(base10)
    await user.type(base10, "50")

    const withholding = screen.getByLabelText("IRPF")
    await user.clear(withholding)
    await user.type(withholding, "10")

    expect(screen.getByLabelText("Total base imponible")).toHaveValue(150)
    expect(screen.getByLabelText("Total cuota IVA")).toHaveValue(26)
    expect(screen.getByLabelText(/Total factura/)).toHaveValue(166)
    expect(screen.getByLabelText("Total base imponible")).toHaveAttribute("readonly")
    expect(screen.getByLabelText("Total cuota IVA")).toHaveAttribute("readonly")
    expect(screen.getByLabelText(/Total factura/)).toHaveAttribute("readonly")
  })

  it("recalculates totals when an existing invoice is opened", () => {
    const initialValues = {
      ...emptyAccountingInvoice(),
      date: "2026-07-15",
      base21: "100.00",
      vat21: "21.00",
      totalBase: "999.00",
      totalVat: "999.00",
      invoiceTotal: "999.00",
      source: "OCR" as const,
    }
    renderForm(initialValues)

    expect(screen.getByLabelText("Total base imponible")).toHaveValue(100)
    expect(screen.getByLabelText("Total cuota IVA")).toHaveValue(21)
    expect(screen.getByLabelText(/Total factura/)).toHaveValue(121)
  })

  it("searches suppliers by name and fills the NIF when selected", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suppliers: [{ id: "supplier-1", legalName: "Cafés Candelas, SLU", taxId: "B27013713" }] }),
    })
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByRole("combobox", { name: "Proveedor / acreedor (opcional)" }), "Candelas")

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const supplier = await screen.findByRole("option", { name: /Cafés Candelas, SLU.*B27013713/ })
    await user.click(supplier)

    expect(screen.getByRole("combobox", { name: "Proveedor / acreedor (opcional)" })).toHaveValue("Cafés Candelas, SLU")
    expect(screen.getByRole("combobox", { name: "NIF" })).toHaveValue("B27013713")
  })

  it("searches suppliers by NIF", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suppliers: [{ id: "supplier-1", legalName: "Cafés Candelas, SLU", taxId: "B27013713" }] }),
    })
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByRole("combobox", { name: "NIF" }), "b270")

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(await screen.findByRole("option", { name: /Cafés Candelas, SLU.*B27013713/ })).toBeInTheDocument()
  })
})
