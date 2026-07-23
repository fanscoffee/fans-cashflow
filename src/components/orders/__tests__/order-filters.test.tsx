import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import OrderFilters from "../order-filters"

vi.mock("@/lib/csv", () => ({
  downloadCSV: vi.fn(),
}))

import { downloadCSV } from "@/lib/csv"

const baseOrders = [
  {
    id: "o1",
    clientName: "Juan",
    clientPhone: "555",
    deliveryDate: "2026-07-22T14:00:00.000Z",
    comment: null,
    isPaid: false,
    isDelivered: false,
    createdAt: "2026-07-20T10:00:00.000Z",
    createdBy: { name: "Admin", email: "admin@test.com" },
  },
]

describe("OrderFilters", () => {
  const onMonthChange = vi.fn()
  const onYearChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders month and year selects", () => {
    render(
      <OrderFilters
        selectedMonth={7}
        selectedYear={2026}
        onMonthChange={onMonthChange}
        onYearChange={onYearChange}
        orders={[]}
      />
    )
    expect(screen.getByDisplayValue("Julio")).toBeInTheDocument()
    expect(screen.getByDisplayValue("2026")).toBeInTheDocument()
  })

  it("calls onMonthChange when month is changed", () => {
    render(
      <OrderFilters
        selectedMonth={7}
        selectedYear={2026}
        onMonthChange={onMonthChange}
        onYearChange={onYearChange}
        orders={[]}
      />
    )
    fireEvent.change(screen.getByDisplayValue("Julio"), { target: { value: "3" } })
    expect(onMonthChange).toHaveBeenCalledWith(3)
  })

  it("calls onYearChange when year is changed", () => {
    render(
      <OrderFilters
        selectedMonth={7}
        selectedYear={2026}
        onMonthChange={onMonthChange}
        onYearChange={onYearChange}
        orders={[]}
      />
    )
    const yearSelect = screen.getByDisplayValue("2026")
    fireEvent.change(yearSelect, { target: { value: "2025" } })
    expect(onYearChange).toHaveBeenCalledWith(2025)
  })

  it("disables export button when orders is empty", () => {
    render(
      <OrderFilters
        selectedMonth={7}
        selectedYear={2026}
        onMonthChange={onMonthChange}
        onYearChange={onYearChange}
        orders={[]}
      />
    )
    expect(screen.getByText("Exportar")).toBeDisabled()
  })

  it("enables export button when orders exist", () => {
    render(
      <OrderFilters
        selectedMonth={7}
        selectedYear={2026}
        onMonthChange={onMonthChange}
        onYearChange={onYearChange}
        orders={baseOrders}
      />
    )
    expect(screen.getByText("Exportar")).not.toBeDisabled()
  })

  it("calls downloadCSV when export is clicked", () => {
    render(
      <OrderFilters
        selectedMonth={7}
        selectedYear={2026}
        onMonthChange={onMonthChange}
        onYearChange={onYearChange}
        orders={baseOrders}
      />
    )
    fireEvent.click(screen.getByText("Exportar"))
    expect(downloadCSV).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ Cliente: "Juan" })]),
      "encargos-2026-07.csv"
    )
  })
})
