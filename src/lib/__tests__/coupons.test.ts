import { afterEach, describe, expect, it, vi } from "vitest"
import {
  expireCouponAt,
  generateCouponCode,
  normalizeCouponCode,
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

  it("expires a coupon 15 calendar days after sending", () => {
    expect(expireCouponAt(new Date("2026-10-11T10:00:00.000Z"))).toEqual(
      new Date("2026-10-26T10:00:00.000Z")
    )
  })

  it("normalizes entered codes", () => {
    expect(normalizeCouponCode("  tarta15-juan-abc123 ")).toBe("TARTA15-JUAN-ABC123")
  })
})
