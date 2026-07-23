import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import OrderList from "../order-list"

const mockOrders = [
  {
    id: "1",
    clientName: "Juan",
    clientPhone: "555-1234",
    deliveryDate: "2026-07-22T14:30:00.000Z",
    comment: null,
    isPaid: false,
    isDelivered: false,
    createdAt: "2026-07-22T10:00:00.000Z",
    createdBy: { name: "Admin", email: "admin@test.com" },
  },
]

describe("OrderList", () => {
  it("renders orders in both mobile cards and desktop table", () => {
    render(
      <OrderList
        orders={mockOrders}
        canEdit={false}
        canDelete={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleStatus={vi.fn()}
        sortField="deliveryDate"
        sortDirection="asc"
        onSort={vi.fn()}
      />
    )
    const juanElements = screen.getAllByText("Juan")
    expect(juanElements.length).toBeGreaterThanOrEqual(2)
  })

  it("passes canEdit to both sub-components", () => {
    render(
      <OrderList
        orders={mockOrders}
        canEdit={true}
        canDelete={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleStatus={vi.fn()}
        sortField="deliveryDate"
        sortDirection="asc"
        onSort={vi.fn()}
      />
    )
    const actionButtons = screen.getAllByLabelText("Acciones")
    expect(actionButtons.length).toBeGreaterThanOrEqual(2)
  })

  it("passes onToggleStatus to both sub-components", () => {
    render(
      <OrderList
        orders={mockOrders}
        canEdit={false}
        canDelete={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleStatus={vi.fn()}
        sortField="deliveryDate"
        sortDirection="asc"
        onSort={vi.fn()}
      />
    )
    const actionButtons = screen.getAllByLabelText("Acciones")
    expect(actionButtons.length).toBeGreaterThanOrEqual(2)
  })
})
