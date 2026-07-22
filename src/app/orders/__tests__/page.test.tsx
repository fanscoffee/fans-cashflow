import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import OrdersPage from "../page"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}))

vi.mock("@/components/app-header", () => ({
  default: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div data-testid="app-header">
      <span>{title}</span>
      {subtitle && <span>{subtitle}</span>}
    </div>
  ),
}))

vi.mock("@/components/notification-bell", () => ({
  default: () => <div data-testid="notification-bell" />,
}))

vi.mock("@/components/orders/order-form", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="order-form">
      <button onClick={() => (props.onSubmit as Function)({ clientName: "Test", clientPhone: "123", deliveryDate: "2026-07-25", deliveryTime: "10:00" })}>
        Submit
      </button>
      <button onClick={() => (props.onCancel as Function)()}>Cancel</button>
    </div>
  ),
}))

vi.mock("@/components/orders/order-list", () => ({
  default: ({ orders, onEdit, onDelete }: Record<string, unknown>) => (
    <div data-testid="order-list">
      {(orders as any[]).map((o: any) => (
        <div key={o.id}>
          <span>{o.clientName}</span>
          <button onClick={() => (onEdit as Function)(o)}>Edit</button>
          <button onClick={() => (onDelete as Function)(o.id)}>Delete</button>
        </div>
      ))}
    </div>
  ),
}))

vi.mock("@/components/orders/order-filters", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="order-filters">
      <button onClick={() => (props.onMonthChange as Function)(1)}>ChangeMonth</button>
    </div>
  ),
}))

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

const mockOrders = [
  { id: "o1", clientName: "Juan", clientPhone: "123", deliveryDate: "2026-07-25T10:00:00Z", status: "PENDIENTE", comment: null },
  { id: "o2", clientName: "Ana", clientPhone: "456", deliveryDate: "2026-07-26T12:00:00Z", status: "ENTREGADO", comment: "Urgente" },
]

describe("OrdersPage", () => {
  const mockPush = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date("2026-07-22T12:00:00Z"))
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any)
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: "ADMIN" } },
      status: "authenticated",
      update: vi.fn(),
    } as any)
    vi.spyOn(global, "fetch").mockImplementation((url: string | URL | Request) => {
      const u = typeof url === "string" ? url : ""
      if (u.includes("/api/orders")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockOrders) } as any)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(null) } as any)
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders loading state initially", () => {
    vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}))
    render(<OrdersPage />)
    expect(screen.getByText("Cargando...")).toBeInTheDocument()
  })

  it("renders orders after loading", async () => {
    render(<OrdersPage />)
    await waitFor(() => {
      expect(screen.getAllByText("Juan").length).toBeGreaterThan(0)
    })
  })

  it("renders order list component", async () => {
    render(<OrdersPage />)
    await waitFor(() => {
      expect(screen.getByTestId("order-list")).toBeInTheDocument()
    })
  })

  it("shows order-filters for ADMIN", async () => {
    render(<OrdersPage />)
    await waitFor(() => {
      expect(screen.getByTestId("order-filters")).toBeInTheDocument()
    })
  })

  it("hides order-filters for EMPLEADO", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: "EMPLEADO" } },
      status: "authenticated",
      update: vi.fn(),
    } as any)
    render(<OrdersPage />)
    await waitFor(() => {
      expect(screen.getByTestId("order-list")).toBeInTheDocument()
    })
    expect(screen.queryByTestId("order-filters")).not.toBeInTheDocument()
  })

  it("toggles form on +Nuevo click", async () => {
    render(<OrdersPage />)
    await waitFor(() => {
      expect(screen.getByTestId("order-list")).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText("+ Nuevo"))
    expect(screen.getByTestId("order-form")).toBeInTheDocument()
    expect(screen.getByText("Cancelar")).toBeInTheDocument()
  })

  it("hides form when Cancelar clicked", async () => {
    render(<OrdersPage />)
    await waitFor(() => {
      expect(screen.getByTestId("order-list")).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText("+ Nuevo"))
    expect(screen.getByTestId("order-form")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Cancelar"))
    expect(screen.queryByTestId("order-form")).not.toBeInTheDocument()
  })

  it("shows empty message when no orders", async () => {
    vi.mocked(global.fetch).mockImplementation((url: string | URL | Request) => {
      const u = typeof url === "string" ? url : ""
      if (u.includes("/api/orders")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as any)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(null) } as any)
    })
    render(<OrdersPage />)
    await waitFor(() => {
      expect(screen.getByText("No hay encargos para este período.")).toBeInTheDocument()
    })
  })

  it("toggles form between create and cancel", async () => {
    render(<OrdersPage />)
    await waitFor(() => {
      expect(screen.getByTestId("order-list")).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText("+ Nuevo"))
    expect(screen.getByText("Cancelar")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Cancelar"))
    expect(screen.queryByTestId("order-form")).not.toBeInTheDocument()
    expect(screen.getByText("+ Nuevo")).toBeInTheDocument()
  })
})
