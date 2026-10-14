import { describe, expect, it, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    coupon: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn() as unknown as () => Promise<null>,
}))

import { POST } from "../route"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

describe("POST /api/cupones/[couponId]/compartir", () => {
  const context = { params: Promise.resolve({ couponId: "c1" }) }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requires authentication", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)

    const response = await POST(new Request("http://localhost/api/cupones/c1", { method: "POST" }) as unknown as NextRequest, context)

    expect(response.status).toBe(401)
  })

  it("rejects users who cannot share coupons", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1", role: "EMPLEADO" } } as any)

    const response = await POST(new Request("http://localhost/api/cupones/c1", { method: "POST" }) as unknown as NextRequest, context)

    expect(response.status).toBe(403)
    expect(prisma.coupon.findUnique).not.toHaveBeenCalled()
  })

  it("activates a pending coupon for a delivered order", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1", role: "SOCIO" } } as any)
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
      id: "c1",
      sendStatus: "PENDING",
      sentAt: null,
      expiresAt: null,
      usedAt: null,
      order: { isDelivered: true },
    } as any)
    vi.mocked(prisma.coupon.updateMany).mockResolvedValue({ count: 1 } as any)

    const response = await POST(new Request("http://localhost/api/cupones/c1", { method: "POST" }) as unknown as NextRequest, context)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ id: "c1" })
    expect(prisma.coupon.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "c1", usedAt: null }),
        data: expect.objectContaining({ sendStatus: "SENT", nextAttemptAt: null, lastError: null }),
      })
    )
  })

  it("does not activate a coupon before delivery", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } } as any)
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
      id: "c1",
      sendStatus: "PENDING",
      sentAt: null,
      expiresAt: null,
      usedAt: null,
      order: { isDelivered: false },
    } as any)

    const response = await POST(new Request("http://localhost/api/cupones/c1", { method: "POST" }) as unknown as NextRequest, context)

    expect(response.status).toBe(409)
    expect(prisma.coupon.updateMany).not.toHaveBeenCalled()
  })

  it("is idempotent for an already shared coupon", async () => {
    const sentAt = new Date("2026-10-12T10:00:00.000Z")
    const expiresAt = new Date("2026-10-27T10:00:00.000Z")
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1", role: "SOCIO" } } as any)
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
      id: "c1",
      sendStatus: "SENT",
      sentAt,
      expiresAt,
      usedAt: null,
      order: { isDelivered: true },
    } as any)

    const response = await POST(new Request("http://localhost/api/cupones/c1", { method: "POST" }) as unknown as NextRequest, context)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: "c1", sentAt: sentAt.toISOString(), expiresAt: expiresAt.toISOString() })
    expect(prisma.coupon.updateMany).not.toHaveBeenCalled()
  })
})
