import { render, screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import OrdersPage from "../orders-client"

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: { id: "obrador-1", email: "obrador@test.com", name: "Obrador User", role: "OBRADOR" },
    },
    status: "authenticated",
  }),
}))

vi.mock("@/components/app-header", () => ({
  default: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
}))

function localDateStr(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function localDateTime(offsetDays: number, hour = 12): string {
  return `${localDateStr(offsetDays)}T${String(hour).padStart(2, "0")}:00:00`
}

const today = localDateStr(0)

const mockOrders = [
  {
    id: "1",
    clientName: "Cliente Ayer",
    clientPhone: "555-0001",
    deliveryDate: localDateTime(-1),
    comment: "Pedido de ayer",
    createdAt: localDateTime(-1, 10),
    createdBy: { name: "Admin", email: "admin@test.com" },
  },
  {
    id: "2",
    clientName: "Cliente Hoy",
    clientPhone: "555-0002",
    deliveryDate: localDateTime(0),
    comment: "Pedido de hoy",
    createdAt: localDateTime(0, 8),
    createdBy: { name: "Admin", email: "admin@test.com" },
  },
  {
    id: "3",
    clientName: "Cliente Mañana",
    clientPhone: "555-0003",
    deliveryDate: localDateTime(1, 16),
    comment: "Pedido de mañana",
    createdAt: localDateTime(0, 9),
    createdBy: { name: "Admin", email: "admin@test.com" },
  },
]

const server = setupServer(
  http.get("/api/encargos", () => {
    const filtered = mockOrders.filter((o) => o.deliveryDate.slice(0, 10) >= today)
    return HttpResponse.json(filtered)
  }),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("OrdersPage - OBRADOR role date filter", () => {
  it("does not show orders with deliveryDate before today", async () => {
    render(<OrdersPage />)

    await waitFor(() => {
      expect(screen.getAllByText("Cliente Hoy").length).toBeGreaterThan(0)
    })

    expect(screen.queryByText("Cliente Ayer")).not.toBeInTheDocument()
  })

  it("shows orders with deliveryDate today and in the future", async () => {
    render(<OrdersPage />)

    await waitFor(() => {
      expect(screen.getAllByText("Cliente Hoy").length).toBeGreaterThan(0)
    })

    expect(screen.getAllByText("Cliente Mañana").length).toBeGreaterThan(0)
  })
})
