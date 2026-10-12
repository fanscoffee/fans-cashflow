import { randomBytes } from "node:crypto"

export const COUPON_VALIDITY_DAYS = 15
export const DEFAULT_COUPON_DELAY_HOURS = 24

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function getCouponDiscountPercentage() {
  return Math.min(readPositiveInteger(process.env.COUPON_DISCOUNT_PERCENTAGE, 15), 100)
}

export function getCouponDelayHours() {
  return readPositiveInteger(process.env.COUPON_DELAY_HOURS, DEFAULT_COUPON_DELAY_HOURS)
}

export function scheduleCouponAt(deliveredAt: Date) {
  return new Date(deliveredAt.getTime() + getCouponDelayHours() * 60 * 60 * 1000)
}

export function expireCouponAt(sentAt: Date) {
  return new Date(sentAt.getTime() + COUPON_VALIDITY_DAYS * 24 * 60 * 60 * 1000)
}

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "")
}

function clientNameSlug(clientName: string) {
  const slug = clientName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 18)

  return slug || "CLIENTE"
}

export function generateCouponCode(clientName: string) {
  const suffix = randomBytes(3).toString("hex").toUpperCase()
  return `TARTA${getCouponDiscountPercentage()}-${clientNameSlug(clientName)}-${suffix}`
}

export function nextCouponAttemptAt(now: Date, attempts: number) {
  const delayMinutes = Math.min(15 * Math.max(attempts, 1), 4 * 60)
  return new Date(now.getTime() + delayMinutes * 60 * 1000)
}

export function formatCouponDate(date: Date) {
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: process.env.APP_TIME_ZONE || "Europe/Madrid",
  })
}
