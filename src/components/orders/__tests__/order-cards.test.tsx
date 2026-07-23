import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import OrderCards from "../order-cards"

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
    isDelivered: false,
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

describe("OrderCards", () => {
  it("renders order data in cards", () => {
    render(<OrderCards {...defaultProps} />)
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument()
    expect(screen.getByText("María García")).toBeInTheDocument()
    expect(screen.getByText("555-1234")).toBeInTheDocument()
  })

  it("shows three-dot action buttons for each card", () => {
    render(<OrderCards {...defaultProps} />)
    const actionButtons = screen.getAllByLabelText("Acciones")
    expect(actionButtons.length).toBe(2)
  })

  it("shows Pagado badge when order is paid", () => {
    render(<OrderCards {...defaultProps} />)
    const pagadoBadges = screen.getAllByText("Pagado")
    expect(pagadoBadges.length).toBeGreaterThanOrEqual(1)
  })

  it("hides buttons when not permitted", () => {
    render(<OrderCards {...defaultProps} />)
    expect(screen.queryByText("Editar")).not.toBeInTheDocument()
    expect(screen.queryByText("Eliminar")).not.toBeInTheDocument()
  })

  it("calls onDelete when delete button clicked from dropdown", async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(<OrderCards {...defaultProps} canEdit canDelete onDelete={onDelete} />)

    const actionButtons = screen.getAllByLabelText("Acciones")
    await user.click(actionButtons[0])

    await user.click(screen.getAllByText("Eliminar")[0])
    expect(onDelete).toHaveBeenCalledWith("1")
  })

  it("calls onEdit when edit button clicked from dropdown", async () => {
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(<OrderCards {...defaultProps} canEdit onEdit={onEdit} />)

    const actionButtons = screen.getAllByLabelText("Acciones")
    await user.click(actionButtons[0])

    await user.click(screen.getAllByText("Editar")[0])
    expect(onEdit).toHaveBeenCalledWith(mockOrders[0])
  })

  it("displays comment when present", () => {
    render(<OrderCards {...defaultProps} />)
    expect(screen.getByText("Entregar en la puerta")).toBeInTheDocument()
  })

  it("displays createdBy name", () => {
    render(<OrderCards {...defaultProps} />)
    const items = screen.getAllByText(/Por: Admin/)
    expect(items.length).toBe(2)
  })
})
