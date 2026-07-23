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
    isPaid: false,
    isDelivered: false,
    createdAt: "2026-07-22T10:00:00.000Z",
    createdBy: { name: "Admin", email: "admin@test.com" },
  },
  {
    id: "2",
    clientName: "María García",
    clientPhone: "555-5678",
    deliveryDate: "2026-07-23T10:00:00.000Z",
    comment: null,
    isPaid: true,
    isDelivered: true,
    createdAt: "2026-07-22T11:00:00.000Z",
    createdBy: { name: "Admin", email: "admin@test.com" },
  },
]

const defaultProps = {
  orders: mockOrders,
  canEdit: false,
  canDelete: false,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onToggleStatus: vi.fn(),
}

describe("OrderTable", () => {
  it("renders order data in table rows", () => {
    render(<OrderTable {...defaultProps} />)
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument()
    expect(screen.getByText("María García")).toBeInTheDocument()
    expect(screen.getByText("555-1234")).toBeInTheDocument()
    expect(screen.getByText("Entregar en la puerta")).toBeInTheDocument()
  })

  it("shows table headers", () => {
    render(<OrderTable {...defaultProps} />)
    expect(screen.getByText("Creado")).toBeInTheDocument()
    expect(screen.getByText("Entrega")).toBeInTheDocument()
    expect(screen.getByText("Cliente")).toBeInTheDocument()
    expect(screen.getByText("Acciones")).toBeInTheDocument()
  })

  it("shows three-dot action buttons for each order", () => {
    render(<OrderTable {...defaultProps} />)
    const actionButtons = screen.getAllByLabelText("Acciones")
    expect(actionButtons.length).toBe(2)
  })

  it("shows status badges when order has status", () => {
    render(<OrderTable {...defaultProps} />)
    const pagadoBadges = screen.getAllByText("Pagado")
    const entregadoBadges = screen.getAllByText("Entregado")
    expect(pagadoBadges.length).toBeGreaterThanOrEqual(1)
    expect(entregadoBadges.length).toBeGreaterThanOrEqual(1)
  })

  it("hides edit and delete buttons when not permitted", () => {
    render(<OrderTable {...defaultProps} />)
    expect(screen.queryByText("Editar")).not.toBeInTheDocument()
    expect(screen.queryByText("Eliminar")).not.toBeInTheDocument()
  })

  it("calls onDelete with order id when delete button clicked", async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(<OrderTable {...defaultProps} canEdit canDelete onDelete={onDelete} />)

    const actionButtons = screen.getAllByLabelText("Acciones")
    await user.click(actionButtons[0])

    await user.click(screen.getAllByText("Eliminar")[0])
    expect(onDelete).toHaveBeenCalledWith("1")
  })

  it("calls onEdit with order when edit button clicked", async () => {
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(<OrderTable {...defaultProps} canEdit onEdit={onEdit} />)

    const actionButtons = screen.getAllByLabelText("Acciones")
    await user.click(actionButtons[0])

    await user.click(screen.getAllByText("Editar")[0])
    expect(onEdit).toHaveBeenCalledWith(mockOrders[0])
  })

  it("renders '—' for null comment", () => {
    render(<OrderTable {...defaultProps} />)
    expect(screen.getAllByText("—").length).toBeGreaterThan(0)
  })
})
