import { randomBytes } from "node:crypto"

export const COUPON_VALIDITY_DAYS = 15
const COUPON_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function getCouponDiscountPercentage() {
  return Math.min(readPositiveInteger(process.env.COUPON_DISCOUNT_PERCENTAGE, 10), 100)
}

export function expireCouponAt(sentAt: Date) {
  return new Date(sentAt.getTime() + COUPON_VALIDITY_DAYS * 24 * 60 * 60 * 1000)
}

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "")
}

export function generateCouponCode() {
  return Array.from(randomBytes(4), (byte) => COUPON_CODE_ALPHABET[byte % COUPON_CODE_ALPHABET.length]).join("")
}
