import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach } from "vitest"
import OrderActions from "../order-actions"

const mockOrder = {
  id: "1",
  clientName: "Juan Pérez",
  clientPhone: "555-1234",
  deliveryDate: "2026-07-22T14:30:00.000Z",
  comment: null,
  isPaid: false,
  isDelivered: false,
  createdAt: "2026-07-22T10:00:00.000Z",
  createdBy: { name: "Admin", email: "admin@test.com" },
}

const defaultProps = {
  order: mockOrder,
  canEdit: true,
  canDelete: true,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onToggleStatus: vi.fn(),
}

describe("OrderActions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders three-dot button", () => {
    render(<OrderActions {...defaultProps} />)
    expect(screen.getByLabelText("Acciones")).toBeInTheDocument()
  })

  it("opens dropdown on click", async () => {
    const user = userEvent.setup()
    render(<OrderActions {...defaultProps} />)
    await user.click(screen.getByLabelText("Acciones"))
    expect(screen.getByText("Editar")).toBeInTheDocument()
    expect(screen.getByText("Eliminar")).toBeInTheDocument()
    expect(screen.getByText("Pagado")).toBeInTheDocument()
    expect(screen.getByText("Entregado")).toBeInTheDocument()
  })

  it("calls onEdit when Editar clicked", async () => {
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(<OrderActions {...defaultProps} onEdit={onEdit} />)
    await user.click(screen.getByLabelText("Acciones"))
    await user.click(screen.getByText("Editar"))
    expect(onEdit).toHaveBeenCalledWith(mockOrder)
  })

  it("calls onDelete when Eliminar clicked", async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(<OrderActions {...defaultProps} onDelete={onDelete} />)
    await user.click(screen.getByLabelText("Acciones"))
    await user.click(screen.getByText("Eliminar"))
    expect(onDelete).toHaveBeenCalledWith("1")
  })

  it("calls onToggleStatus with confirm when Pagado clicked", async () => {
    vi.spyOn(global, "confirm").mockReturnValue(true)
    const onToggleStatus = vi.fn()
    const user = userEvent.setup()
    render(<OrderActions {...defaultProps} onToggleStatus={onToggleStatus} />)
    await user.click(screen.getByLabelText("Acciones"))
    await user.click(screen.getByText("Pagado"))
    expect(onToggleStatus).toHaveBeenCalledWith("1", "isPaid", true)
  })

  it("calls onToggleStatus with confirm when Entregado clicked", async () => {
    vi.spyOn(global, "confirm").mockReturnValue(true)
    const onToggleStatus = vi.fn()
    const user = userEvent.setup()
    render(<OrderActions {...defaultProps} onToggleStatus={onToggleStatus} />)
    await user.click(screen.getByLabelText("Acciones"))
    await user.click(screen.getByText("Entregado"))
    expect(onToggleStatus).toHaveBeenCalledWith("1", "isDelivered", true)
  })

  it("does not call onToggleStatus when confirm is cancelled", async () => {
    vi.spyOn(global, "confirm").mockReturnValue(false)
    const onToggleStatus = vi.fn()
    const user = userEvent.setup()
    render(<OrderActions {...defaultProps} onToggleStatus={onToggleStatus} />)
    await user.click(screen.getByLabelText("Acciones"))
    await user.click(screen.getByText("Pagado"))
    expect(onToggleStatus).not.toHaveBeenCalled()
  })

  it("hides Editar and Eliminar when not permitted", async () => {
    const user = userEvent.setup()
    render(<OrderActions {...defaultProps} canEdit={false} canDelete={false} />)
    await user.click(screen.getByLabelText("Acciones"))
    expect(screen.queryByText("Editar")).not.toBeInTheDocument()
    expect(screen.queryByText("Eliminar")).not.toBeInTheDocument()
  })

  it("always shows Pagado and Entregado regardless of permissions", async () => {
    const user = userEvent.setup()
    render(<OrderActions {...defaultProps} canEdit={false} canDelete={false} />)
    await user.click(screen.getByLabelText("Acciones"))
    expect(screen.getByText("Pagado")).toBeInTheDocument()
    expect(screen.getByText("Entregado")).toBeInTheDocument()
  })

  it("shows confirmation to desmarcar when isPaid is true", async () => {
    vi.spyOn(global, "confirm").mockReturnValue(true)
    const onToggleStatus = vi.fn()
    const order = { ...mockOrder, isPaid: true }
    const user = userEvent.setup()
    render(<OrderActions {...defaultProps} order={order} onToggleStatus={onToggleStatus} />)
    await user.click(screen.getByLabelText("Acciones"))
    await user.click(screen.getByText("Pagado"))
    expect(global.confirm).toHaveBeenCalledWith("¿Desmarcar como pagado?")
    expect(onToggleStatus).toHaveBeenCalledWith("1", "isPaid", false)
  })
})
