import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    coupon: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import { lookupCoupon, redeemCoupon } from "@/lib/coupon-validation"

describe("coupon validation", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns a valid coupon with customer and expiry details", async () => {
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
      code: "TARTA15-JUAN-ABC123",
      discountPercentage: 15,
      sendStatus: "SENT",
      sentAt: new Date("2026-10-11T10:00:00.000Z"),
      expiresAt: new Date("2026-10-26T10:00:00.000Z"),
      usedAt: null,
      usedBy: null,
      order: { clientName: "Juan" },
    } as any)

    const result = await lookupCoupon(" tarta15-juan-abc123 ", new Date("2026-10-12T10:00:00.000Z"))

    expect(result).toMatchObject({ valid: true, status: "VALID" })
    expect(result.valid && result.coupon.clientName).toBe("Juan")
  })

  it("distinguishes used and expired coupons", async () => {
    const usedAt = new Date("2026-10-11T11:30:00.000Z")
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
      code: "USED",
      discountPercentage: 15,
      sentAt: new Date("2026-10-01T10:00:00.000Z"),
      expiresAt: new Date("2026-10-16T10:00:00.000Z"),
      usedAt,
      usedBy: { name: "Ana", email: "ana@example.com", role: "PARTNER" },
      order: { clientName: "Juan" },
    } as any)
    await expect(lookupCoupon("USED")).resolves.toMatchObject({
      status: "USED",
      valid: false,
      coupon: {
        usedAt,
        usedBy: { name: "Ana", email: "ana@example.com", role: "PARTNER" },
      },
    })

    vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
      code: "EXPIRED",
      usedAt: null,
      sendStatus: "SENT",
      sentAt: new Date("2026-10-01T10:00:00.000Z"),
      expiresAt: new Date("2026-10-10T10:00:00.000Z"),
      discountPercentage: 15,
      usedBy: null,
      order: {
        id: "order-1",
        clientName: "Juan",
        clientPhone: "600123456",
        deliveryDate: new Date("2026-10-05T12:00:00.000Z"),
        deliveryLocation: "CAFETERIA",
        comment: "Llamar al llegar",
        isPaid: true,
        isDelivered: true,
        deliveredAt: new Date("2026-10-05T12:30:00.000Z"),
        createdAt: new Date("2026-10-04T09:00:00.000Z"),
      },
    } as any)
    await expect(lookupCoupon("EXPIRED", new Date("2026-10-11T10:00:00.000Z"))).resolves.toMatchObject({
      status: "EXPIRED",
      valid: false,
      message: "Este código ha caducado porque han pasado 15 días desde que se compartió. Estos son los datos del encargo asociado:",
      coupon: {
        order: {
          id: "order-1",
          clientPhone: "600123456",
          deliveryLocation: "CAFETERIA",
        },
      },
    })
  })

  it("redeems with a conditional update so only one request wins", async () => {
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
      code: "VALID",
      discountPercentage: 15,
      sendStatus: "SENT",
      sentAt: new Date("2026-10-11T10:00:00.000Z"),
      expiresAt: new Date("2026-10-26T10:00:00.000Z"),
      usedAt: null,
      usedBy: null,
      order: { clientName: "Ana" },
    } as any)
    vi.mocked(prisma.coupon.updateMany).mockResolvedValue({ count: 1 })

    const result = await redeemCoupon("VALID", "staff-1", new Date("2026-10-12T10:00:00.000Z"))

    expect(result).toMatchObject({ valid: true, status: "REDEEMED" })
    expect(prisma.coupon.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ usedAt: null }),
        data: { usedAt: expect.any(Date), usedById: "staff-1" },
      })
    )
  })
})
