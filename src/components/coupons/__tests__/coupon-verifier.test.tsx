import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import CouponVerifier from "../coupon-verifier"

const server = setupServer(
  http.post("/api/cupones/validar", () => HttpResponse.json({
    valid: false,
    status: "USED",
    message: "Este código ya ha sido utilizado. Estos son los datos de su primer canje:",
    coupon: {
      code: "TARTA15-JUAN-ABC123",
      clientName: "Juan Pérez",
      discountPercentage: 15,
      sentAt: "2026-10-01T10:00:00.000Z",
      expiresAt: "2026-10-16T10:00:00.000Z",
      usedAt: "2026-10-11T11:30:00.000Z",
      usedBy: { name: "Ana García", email: "ana@example.com", role: "PARTNER" },
    },
  })),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("CouponVerifier", () => {
  it("shows the first redemption details for a previously used code", async () => {
    const user = userEvent.setup()
    render(<CouponVerifier />)

    await user.type(screen.getByLabelText("Código de cupón"), "TARTA15-JUAN-ABC123")
    await user.click(screen.getByRole("button", { name: "Comprobar" }))

    await waitFor(() => expect(screen.getByText("Primer canje")).toBeInTheDocument())
    expect(screen.getByText("Este código ya ha sido utilizado. Estos son los datos de su primer canje:")).toBeInTheDocument()
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument()
    expect(screen.getByText("Ana García")).toBeInTheDocument()
    expect(screen.getByText("ana@example.com · PARTNER")).toBeInTheDocument()
    expect(screen.getByText("TARTA15-JUAN-ABC123")).toBeInTheDocument()
  })

  it("shows the linked order details for an expired code", async () => {
    server.use(
      http.post("/api/cupones/validar", () => HttpResponse.json({
        valid: false,
        status: "EXPIRED",
        message: "Este código ha caducado porque han pasado 15 días desde que se compartió. Estos son los datos del encargo asociado:",
        coupon: {
          code: "TARTA15-TEST-CUPON-85A606",
          clientName: "Juan Pérez",
          discountPercentage: 15,
          sentAt: "2026-10-01T10:00:00.000Z",
          expiresAt: "2026-10-10T10:00:00.000Z",
          usedAt: null,
          usedBy: null,
          order: {
            id: "order-1",
            clientName: "Juan Pérez",
            clientPhone: "600123456",
            deliveryDate: "2026-10-05T12:00:00.000Z",
            deliveryLocation: "CAFETERIA",
            comment: "Llamar al llegar",
            isPaid: true,
            isDelivered: true,
            deliveredAt: "2026-10-05T12:30:00.000Z",
            createdAt: "2026-10-04T09:00:00.000Z",
          },
        },
      })),
    )

    const user = userEvent.setup()
    render(<CouponVerifier />)

    await user.type(screen.getByLabelText("Código de cupón"), "TARTA15-TEST-CUPON-85A606")
    await user.click(screen.getByRole("button", { name: "Comprobar" }))

    await waitFor(() => expect(screen.getByText("Encargo asociado")).toBeInTheDocument())
    expect(screen.getByText("Este código ha caducado porque han pasado 15 días desde que se compartió. Estos son los datos del encargo asociado:")).toBeInTheDocument()
    expect(screen.getByText("600123456")).toBeInTheDocument()
    expect(screen.getByText("Llamar al llegar")).toBeInTheDocument()
    expect(screen.getByText("CAFETERIA")).toBeInTheDocument()
  })
})
