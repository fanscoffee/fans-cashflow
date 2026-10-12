import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
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
  http.get("/api/encargos/upcoming", () => HttpResponse.json(mockOrders)),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("NotificationBell", () => {
  it("does not render when there are no orders", async () => {
    server.use(http.get("/api/encargos/upcoming", () => HttpResponse.json([])))
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
      http.get("/api/encargos/upcoming", () => {
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

  it("shows pending coupons for users allowed to share", async () => {
    server.use(
      http.get("/api/cupones/pendientes", () => HttpResponse.json({
        coupons: [{
          id: "c1",
          code: "TARTA15-JUAN-ABC123",
          discountPercentage: 15,
          scheduledFor: new Date().toISOString(),
          sendStatus: "PENDING",
          lastError: null,
          clientName: "Juan Pérez",
          clientPhone: "555-1234",
        }],
      })),
    )

    render(<NotificationBell canShareCoupons />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /notificaciones/i })).toBeInTheDocument()
    })
    await userEvent.setup().click(screen.getByRole("button", { name: /notificaciones/i }))
    expect(screen.getByText("TARTA15-JUAN-ABC123")).toBeInTheDocument()
    expect(screen.getByText("Cupones por compartir")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Compartir código" })).toBeInTheDocument()
  })

  it("activates a coupon only after the copied message is confirmed", async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) }
    server.use(
      http.get("/api/cupones/pendientes", () => HttpResponse.json({
        coupons: [{
          id: "c1",
          code: "TARTA15-JUAN-ABC123",
          discountPercentage: 15,
          scheduledFor: new Date().toISOString(),
          sendStatus: "PENDING",
          lastError: null,
          clientName: "Juan Pérez",
          clientPhone: "555-1234",
        }],
      })),
      http.post("/api/cupones/c1/compartir", () => HttpResponse.json({ id: "c1" })),
    )

    const user = userEvent.setup()
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard })
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined })
    render(<NotificationBell canShareCoupons />)
    await waitFor(() => expect(screen.getByRole("button", { name: /notificaciones/i })).toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: /notificaciones/i }))
    await user.click(screen.getByRole("button", { name: "Compartir código" }))

    await waitFor(() => expect(clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("TARTA15-JUAN-ABC123")))
    expect(screen.getByRole("button", { name: "Marcar como compartido" })).toBeInTheDocument()
    expect(screen.getByText("TARTA15-JUAN-ABC123")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Marcar como compartido" }))
    await waitFor(() => expect(screen.queryByText("TARTA15-JUAN-ABC123")).not.toBeInTheDocument())
  })
})
