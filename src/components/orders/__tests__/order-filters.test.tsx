import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import OrderFilters from "../order-filters"

const mockOrders = [
  {
    id: "1",
    clientName: "Test",
    clientPhone: "555-0000",
    deliveryDate: "2026-07-22T10:00:00.000Z",
    comment: null,
    createdAt: "2026-07-22T08:00:00.000Z",
    createdBy: { name: "Admin", email: "admin@test.com" },
  },
]

describe("OrderFilters", () => {
  it("renders month and year selects", () => {
    render(
      <OrderFilters selectedMonth={7} selectedYear={2026} onMonthChange={vi.fn()} onYearChange={vi.fn()} orders={mockOrders} />
    )
    expect(screen.getByDisplayValue("Julio")).toBeInTheDocument()
    expect(screen.getByDisplayValue("2026")).toBeInTheDocument()
  })

  it("renders export button", () => {
    render(
      <OrderFilters selectedMonth={7} selectedYear={2026} onMonthChange={vi.fn()} onYearChange={vi.fn()} orders={mockOrders} />
    )
    expect(screen.getByRole("button", { name: /exportar/i })).toBeInTheDocument()
  })

  it("calls onMonthChange when month select changes", async () => {
    const onMonthChange = vi.fn()
    const user = userEvent.setup()
    render(
      <OrderFilters selectedMonth={7} selectedYear={2026} onMonthChange={onMonthChange} onYearChange={vi.fn()} orders={mockOrders} />
    )
    await user.selectOptions(screen.getByDisplayValue("Julio"), "8")
    expect(onMonthChange).toHaveBeenCalledWith(8)
  })

  it("calls onYearChange when year select changes", async () => {
    const onYearChange = vi.fn()
    const user = userEvent.setup()
    render(
      <OrderFilters selectedMonth={7} selectedYear={2026} onMonthChange={vi.fn()} onYearChange={onYearChange} orders={mockOrders} />
    )
    await user.selectOptions(screen.getByDisplayValue("2026"), "2025")
    expect(onYearChange).toHaveBeenCalledWith(2025)
  })

  it("disables export button when orders are empty", () => {
    render(
      <OrderFilters selectedMonth={7} selectedYear={2026} onMonthChange={vi.fn()} onYearChange={vi.fn()} orders={[]} />
    )
    expect(screen.getByRole("button", { name: /exportar/i })).toBeDisabled()
  })
})
