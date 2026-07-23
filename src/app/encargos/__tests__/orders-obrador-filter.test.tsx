import { render, screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import OrdersPage from "../page"

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

const today = new Date().toISOString().slice(0, 10)
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

const mockOrders = [
  {
    id: "1",
    clientName: "Cliente Ayer",
    clientPhone: "555-0001",
    deliveryDate: `${yesterday}T14:30:00.000Z`,
    comment: "Pedido de ayer",
    createdAt: `${yesterday}T10:00:00.000Z`,
    createdBy: { name: "Admin", email: "admin@test.com" },
  },
  {
    id: "2",
    clientName: "Cliente Hoy",
    clientPhone: "555-0002",
    deliveryDate: `${today}T10:00:00.000Z`,
    comment: "Pedido de hoy",
    createdAt: `${today}T08:00:00.000Z`,
    createdBy: { name: "Admin", email: "admin@test.com" },
  },
  {
    id: "3",
    clientName: "Cliente Mañana",
    clientPhone: "555-0003",
    deliveryDate: `${tomorrow}T16:00:00.000Z`,
    comment: "Pedido de mañana",
    createdAt: `${today}T09:00:00.000Z`,
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
