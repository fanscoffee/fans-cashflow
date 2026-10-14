import { afterEach, describe, expect, it, vi } from "vitest"
import {
  expireCouponAt,
  generateCouponCode,
  getCouponDiscountPercentage,
  normalizeCouponCode,
} from "@/lib/coupons"

describe("coupon helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("generates a four-character alphanumeric code", () => {
    const code = generateCouponCode()

    expect(code).toMatch(/^[A-Z0-9]{4}$/)
  })

  it("uses a 10 percent discount by default", () => {
    vi.stubEnv("COUPON_DISCOUNT_PERCENTAGE", "")

    expect(getCouponDiscountPercentage()).toBe(10)
  })

  it("expires a coupon 15 calendar days after sending", () => {
    expect(expireCouponAt(new Date("2026-10-11T10:00:00.000Z"))).toEqual(
      new Date("2026-10-26T10:00:00.000Z")
    )
  })

  it("normalizes entered codes", () => {
    expect(normalizeCouponCode("  tarta15-juan-abc123 ")).toBe("TARTA15-JUAN-ABC123")
  })
})
