import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import ProductActions from "../product-actions"

function renderActions(canDelete = true) {
  return render(
    <ProductActions
      onEdit={vi.fn()}
      onSuppliers={vi.fn()}
      onDelete={vi.fn()}
      canDelete={canDelete}
    />,
  )
}

describe("ProductActions", () => {
  it("opens the product actions menu", async () => {
    const user = userEvent.setup()
    renderActions()

    await user.click(screen.getByLabelText("Acciones"))

    expect(screen.getByText("Editar")).toBeInTheDocument()
    expect(screen.getByText("Proveedores")).toBeInTheDocument()
    expect(screen.getByText("Eliminar")).toBeInTheDocument()
  })

  it("hides delete when the user cannot delete products", async () => {
    const user = userEvent.setup()
    renderActions(false)

    await user.click(screen.getByLabelText("Acciones"))

    expect(screen.getByText("Editar")).toBeInTheDocument()
    expect(screen.getByText("Proveedores")).toBeInTheDocument()
    expect(screen.queryByText("Eliminar")).not.toBeInTheDocument()
  })

  it("runs the selected action", async () => {
    const user = userEvent.setup()
    const onSuppliers = vi.fn()
    render(
      <ProductActions
        onEdit={vi.fn()}
        onSuppliers={onSuppliers}
        onDelete={vi.fn()}
        canDelete
      />,
    )

    await user.click(screen.getByLabelText("Acciones"))
    await user.click(screen.getByText("Proveedores"))

    expect(onSuppliers).toHaveBeenCalledOnce()
    expect(screen.queryByText("Proveedores")).not.toBeInTheDocument()
  })
})
