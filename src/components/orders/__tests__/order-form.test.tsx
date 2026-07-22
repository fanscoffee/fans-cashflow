import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import OrderForm from "../order-form"

const defaultSubmit = vi.fn().mockResolvedValue(true)
const defaultCancel = vi.fn()

function renderCreate(overrides?: { onSubmit?: typeof defaultSubmit }) {
  return render(
    <OrderForm
      onSubmit={overrides?.onSubmit ?? defaultSubmit}
      onCancel={defaultCancel}
      saving={false}
    />
  )
}

function getContainer() {
  return document.body.querySelector("form")!
}

function renderEdit() {
  const order = {
    id: "1",
    clientName: "Juan",
    clientPhone: "555-1234",
    deliveryDate: "2026-07-22T14:30:00.000Z",
    comment: "Test comment",
    createdAt: "2026-07-22T10:00:00.000Z",
  }
  return render(
    <OrderForm
      initialValues={order}
      onSubmit={defaultSubmit}
      onCancel={defaultCancel}
      saving={false}
    />
  )
}

describe("OrderForm", () => {
  it("renders all form fields in create mode", () => {
    renderCreate()
    expect(screen.getByText(/nombre del cliente/i)).toBeInTheDocument()
    expect(screen.getByText(/teléfono del cliente/i)).toBeInTheDocument()
    expect(screen.getByText(/fecha de entrega/i)).toBeInTheDocument()
    expect(screen.getByText(/hora de entrega/i)).toBeInTheDocument()
    expect(screen.getByText(/comentario/i)).toBeInTheDocument()
  })

  it("shows 'Crear' button in create mode", () => {
    renderCreate()
    expect(screen.getByRole("button", { name: /crear/i })).toBeInTheDocument()
  })

  it("shows 'Actualizar' button in edit mode", () => {
    renderEdit()
    expect(screen.getByRole("button", { name: /actualizar/i })).toBeInTheDocument()
  })

  it("pre-fills form in edit mode", () => {
    renderEdit()
    expect(screen.getByDisplayValue("Juan")).toBeInTheDocument()
    expect(screen.getByDisplayValue("555-1234")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Test comment")).toBeInTheDocument()
  })

  it("shows validation errors when submitting empty form", async () => {
    const user = userEvent.setup()
    renderCreate()
    await user.click(screen.getByRole("button", { name: /crear/i }))
    await waitFor(() => {
      expect(screen.getByText(/el nombre del cliente es obligatorio/i)).toBeInTheDocument()
      expect(screen.getByText(/el teléfono del cliente es obligatorio/i)).toBeInTheDocument()
    })
  })

  it("calls onSubmit with form data", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(true)
    renderCreate({ onSubmit })

    const form = getContainer()
    const nameInput = form.querySelector('input[name="clientName"]')!
    const phoneInput = form.querySelector('input[name="clientPhone"]')!
    await user.type(nameInput, "María")
    await user.type(phoneInput, "555-9999")
    await user.click(screen.getByRole("button", { name: /crear/i }))

    expect(onSubmit).toHaveBeenCalled()
  })

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup()
    renderCreate()
    await user.click(screen.getByRole("button", { name: /cancelar/i }))
    expect(defaultCancel).toHaveBeenCalled()
  })

  it("shows 'Guardando...' when saving is true", () => {
    render(
      <OrderForm onSubmit={defaultSubmit} onCancel={defaultCancel} saving={true} />
    )
    expect(screen.getByRole("button", { name: /guardando/i })).toBeDisabled()
  })
})
