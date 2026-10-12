import { CouponSendStatus } from "@/lib/database-enums"
import { prisma } from "@/lib/prisma"
import { normalizeCouponCode } from "@/lib/coupons"

export type CouponLookupStatus = "VALID" | "NOT_FOUND" | "USED" | "EXPIRED" | "PENDING"

export type CouponLookupResult =
  | { valid: true; status: "VALID"; message: string; coupon: CouponSummary }
  | { valid: false; status: Exclude<CouponLookupStatus, "VALID">; message: string }

export interface CouponSummary {
  code: string
  clientName: string
  discountPercentage: number
  expiresAt: Date
}

export async function lookupCoupon(code: string, now = new Date()): Promise<CouponLookupResult> {
  const normalizedCode = normalizeCouponCode(code)
  if (!normalizedCode) {
    return { valid: false, status: "NOT_FOUND", message: "Código no válido." }
  }

  const coupon = await prisma.coupon.findUnique({
    where: { code: normalizedCode },
    include: { order: { select: { clientName: true } } },
  })

  if (!coupon) {
    return { valid: false, status: "NOT_FOUND", message: "Código no válido." }
  }

  if (coupon.usedAt) {
    return { valid: false, status: "USED", message: "Este código ya ha sido utilizado." }
  }

  if (coupon.sendStatus !== CouponSendStatus.SENT || !coupon.sentAt || !coupon.expiresAt) {
    return {
      valid: false,
      status: "PENDING",
      message:
        coupon.sendStatus === CouponSendStatus.FAILED
          ? "Este código todavía no está activo porque el mensaje de WhatsApp no se pudo enviar."
          : "Este código todavía no está activo.",
    }
  }

  if (coupon.expiresAt <= now) {
    return { valid: false, status: "EXPIRED", message: "Este código ha caducado." }
  }

  return {
    valid: true,
    status: "VALID",
    message: "Código válido.",
    coupon: {
      code: coupon.code,
      clientName: coupon.order.clientName,
      discountPercentage: coupon.discountPercentage,
      expiresAt: coupon.expiresAt,
    },
  }
}

export async function redeemCoupon(code: string, userId: string, now = new Date()) {
  const lookup = await lookupCoupon(code, now)
  if (!lookup.valid) return lookup

  const redeemed = await prisma.coupon.updateMany({
    where: {
      code: lookup.coupon.code,
      sendStatus: CouponSendStatus.SENT,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: { usedAt: now, usedById: userId },
  })

  if (redeemed.count !== 1) return lookupCoupon(code, new Date())

  return {
    valid: true as const,
    status: "REDEEMED" as const,
    message: "Código canjeado correctamente.",
    coupon: lookup.coupon,
  }
}
