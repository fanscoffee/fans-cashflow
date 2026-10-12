import { describe, expect, it, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    coupon: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn() as unknown as () => Promise<null>,
}))

import { GET } from "../route"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

describe("GET /api/cupones/pendientes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requires authentication", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)

    const response = await GET(new Request("http://localhost/api/cupones/pendientes") as unknown as NextRequest)

    expect(response.status).toBe(401)
  })

  it("rejects employees", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1", role: "EMPLEADO" } } as any)

    const response = await GET(new Request("http://localhost/api/cupones/pendientes") as unknown as NextRequest)

    expect(response.status).toBe(403)
    expect(prisma.coupon.findMany).not.toHaveBeenCalled()
  })

  it("returns pending coupons with client data for partners", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1", role: "SOCIO" } } as any)
    vi.mocked(prisma.coupon.findMany).mockResolvedValue([
      {
        id: "c1",
        code: "TARTA15-JUAN-ABC123",
        discountPercentage: 15,
        scheduledFor: new Date("2026-10-12T10:00:00.000Z"),
        sendStatus: "PENDING",
        lastError: null,
        order: { clientName: "Juan Pérez", clientPhone: "600123456" },
      },
    ] as any)

    const response = await GET(new Request("http://localhost/api/cupones/pendientes") as unknown as NextRequest)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.coupons).toEqual([
      expect.objectContaining({
        id: "c1",
        code: "TARTA15-JUAN-ABC123",
        clientName: "Juan Pérez",
        clientPhone: "600123456",
      }),
    ])
    expect(prisma.coupon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ usedAt: null, order: { isDelivered: true } }),
      })
    )
  })
})
