import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import NotificationBell from "../notification-bell"

const today = new Date().toISOString().slice(0, 10)
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

const mockOrders = [
  {
    id: "1",
    clientName: "Juan Pérez",
    clientPhone: "555-1234",
    deliveryDate: `${today}T14:30:00.000Z`,
    comment: "Entregar en la puerta",
    createdBy: { name: "Admin", email: "admin@test.com" },
  },
  {
    id: "2",
    clientName: "María García",
    clientPhone: "555-5678",
    deliveryDate: `${tomorrow}T10:00:00.000Z`,
    comment: null,
    createdBy: { name: "Admin", email: "admin@test.com" },
  },
]

const server = setupServer(
  http.get("/api/orders", () => HttpResponse.json(mockOrders)),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("NotificationBell", () => {
  it("does not render when there are no orders", async () => {
    server.use(http.get("/api/orders", () => HttpResponse.json([])))
    render(<NotificationBell />)
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /notificaciones/i })).not.toBeInTheDocument()
    })
  })

  it("shows badge with order count", async () => {
    render(<NotificationBell />)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /notificaciones/i })).toBeInTheDocument()
    })
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("opens modal on bell click", async () => {
    const user = userEvent.setup()
    render(<NotificationBell />)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /notificaciones/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole("button", { name: /notificaciones/i }))
    expect(screen.getByText("Encargos próximos")).toBeInTheDocument()
  })

  it("splits orders into today and tomorrow groups", async () => {
    const user = userEvent.setup()
    render(<NotificationBell />)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /notificaciones/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole("button", { name: /notificaciones/i }))
    expect(screen.getByText("Hoy")).toBeInTheDocument()
    expect(screen.getByText("Mañana")).toBeInTheDocument()
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument()
    expect(screen.getByText("María García")).toBeInTheDocument()
  })

  it("shows empty state after re-fetch returns no orders", async () => {
    let callCount = 0
    server.use(
      http.get("/api/orders", () => {
        callCount++
        return HttpResponse.json(callCount === 1 ? mockOrders : [])
      }),
    )
    render(<NotificationBell />)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /notificaciones/i })).toBeInTheDocument()
    })
    await userEvent.setup().click(screen.getByRole("button", { name: /notificaciones/i }))
    await waitFor(() => {
      expect(screen.getByText("No hay encargos próximos.")).toBeInTheDocument()
    })
  })

  it("renders OrderCard with phone, time, and comment", async () => {
    const user = userEvent.setup()
    render(<NotificationBell />)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /notificaciones/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole("button", { name: /notificaciones/i }))
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument()
    expect(screen.getByText("555-1234")).toBeInTheDocument()
    expect(screen.getByText("Entregar en la puerta")).toBeInTheDocument()
    expect(screen.getByText("María García")).toBeInTheDocument()
    expect(screen.getByText("555-5678")).toBeInTheDocument()
  })
})
