import { afterEach, describe, expect, it, vi } from "vitest"
import {
  expireCouponAt,
  generateCouponCode,
  normalizeCouponCode,
  nextCouponAttemptAt,
  scheduleCouponAt,
} from "@/lib/coupons"

describe("coupon helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("generates a readable unique code from the customer name", () => {
    vi.stubEnv("COUPON_DISCOUNT_PERCENTAGE", "15")

    const code = generateCouponCode("María José")

    expect(code).toMatch(/^TARTA15-MARIA-JOSE-[A-F0-9]{6}$/)
  })

  it("schedules delivery follow-up 24 hours later by default", () => {
    const deliveredAt = new Date("2026-10-11T10:00:00.000Z")

    expect(scheduleCouponAt(deliveredAt)).toEqual(new Date("2026-10-12T10:00:00.000Z"))
  })

  it("allows the delay to be configured", () => {
    vi.stubEnv("COUPON_DELAY_HOURS", "2")

    expect(scheduleCouponAt(new Date("2026-10-11T10:00:00.000Z"))).toEqual(
      new Date("2026-10-11T12:00:00.000Z")
    )
  })

  it("expires a coupon 15 calendar days after sending", () => {
    expect(expireCouponAt(new Date("2026-10-11T10:00:00.000Z"))).toEqual(
      new Date("2026-10-26T10:00:00.000Z")
    )
  })

  it("normalizes entered codes and backs off retries", () => {
    const now = new Date("2026-10-11T10:00:00.000Z")

    expect(normalizeCouponCode("  tarta15-juan-abc123 ")).toBe("TARTA15-JUAN-ABC123")
    expect(nextCouponAttemptAt(now, 1)).toEqual(new Date("2026-10-11T10:15:00.000Z"))
    expect(nextCouponAttemptAt(now, 20)).toEqual(new Date("2026-10-11T14:00:00.000Z"))
  })
})
