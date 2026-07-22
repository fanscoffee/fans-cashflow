import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import OrderTable from "../order-table"

const mockOrders = [
  {
    id: "1",
    clientName: "Juan Pérez",
    clientPhone: "555-1234",
    deliveryDate: "2026-07-22T14:30:00.000Z",
    comment: "Entregar en la puerta",
    createdAt: "2026-07-22T10:00:00.000Z",
    createdBy: { name: "Admin", email: "admin@test.com" },
  },
  {
    id: "2",
    clientName: "María García",
    clientPhone: "555-5678",
    deliveryDate: "2026-07-23T10:00:00.000Z",
    comment: null,
    createdAt: "2026-07-22T11:00:00.000Z",
    createdBy: { name: "Admin", email: "admin@test.com" },
  },
]

describe("OrderTable", () => {
  it("renders order data in table rows", () => {
    render(
      <OrderTable orders={mockOrders} canEdit={false} canDelete={false} onEdit={vi.fn()} onDelete={vi.fn()} />
    )
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument()
    expect(screen.getByText("María García")).toBeInTheDocument()
    expect(screen.getByText("555-1234")).toBeInTheDocument()
    expect(screen.getByText("Entregar en la puerta")).toBeInTheDocument()
  })

  it("shows table headers", () => {
    render(
      <OrderTable orders={mockOrders} canEdit={false} canDelete={false} onEdit={vi.fn()} onDelete={vi.fn()} />
    )
    expect(screen.getByText("Creado")).toBeInTheDocument()
    expect(screen.getByText("Entrega")).toBeInTheDocument()
    expect(screen.getByText("Cliente")).toBeInTheDocument()
    expect(screen.getByText("Acciones")).toBeInTheDocument()
  })

  it("shows edit and delete buttons when permitted", () => {
    render(
      <OrderTable orders={mockOrders} canEdit={true} canDelete={true} onEdit={vi.fn()} onDelete={vi.fn()} />
    )
    const editButtons = screen.getAllByText("Editar")
    const deleteButtons = screen.getAllByText("Eliminar")
    expect(editButtons.length).toBe(2)
    expect(deleteButtons.length).toBe(2)
  })

  it("hides edit and delete buttons when not permitted", () => {
    render(
      <OrderTable orders={mockOrders} canEdit={false} canDelete={false} onEdit={vi.fn()} onDelete={vi.fn()} />
    )
    expect(screen.queryByText("Editar")).not.toBeInTheDocument()
    expect(screen.queryByText("Eliminar")).not.toBeInTheDocument()
  })

  it("calls onEdit with order when edit button clicked", async () => {
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(
      <OrderTable orders={mockOrders} canEdit={true} canDelete={false} onEdit={onEdit} onDelete={vi.fn()} />
    )
    await user.click(screen.getAllByText("Editar")[0])
    expect(onEdit).toHaveBeenCalledWith(mockOrders[0])
  })

  it("calls onDelete with order id when delete button clicked", async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(
      <OrderTable orders={mockOrders} canEdit={false} canDelete={true} onEdit={vi.fn()} onDelete={onDelete} />
    )
    await user.click(screen.getAllByText("Eliminar")[0])
    expect(onDelete).toHaveBeenCalledWith("1")
  })

  it("renders '—' for null comment", () => {
    render(
      <OrderTable orders={mockOrders} canEdit={false} canDelete={false} onEdit={vi.fn()} onDelete={vi.fn()} />
    )
    expect(screen.getAllByText("—").length).toBeGreaterThan(0)
  })
})
