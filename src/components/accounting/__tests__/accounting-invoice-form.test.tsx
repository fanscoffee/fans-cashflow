import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import AccountingInvoiceForm from "../accounting-invoice-form"
import { emptyAccountingInvoice } from "@/lib/accounting-invoices"

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderForm() {
  return render(
    <AccountingInvoiceForm
      initialValues={emptyAccountingInvoice()}
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
