import { CouponSendStatus } from "@/lib/database-enums"
import { prisma } from "@/lib/prisma"
import { COUPON_VALIDITY_DAYS, normalizeCouponCode } from "@/lib/coupons"

export type CouponLookupStatus = "VALID" | "NOT_FOUND" | "USED" | "EXPIRED" | "PENDING"

export type CouponLookupResult =
  | { valid: true; status: "VALID"; message: string; coupon: CouponSummary }
  | { valid: false; status: "USED" | "EXPIRED"; message: string; coupon: CouponDetails }
  | { valid: false; status: Exclude<CouponLookupStatus, "VALID" | "USED" | "EXPIRED">; message: string }

export interface CouponRedeemer {
  name: string | null
  email: string
  role: string
}

export interface CouponOrderDetails {
  id: string
  clientName: string
  clientPhone: string
  deliveryDate: Date
  deliveryLocation: string | null
  comment: string | null
  isPaid: boolean
  isDelivered: boolean
  deliveredAt: Date | null
  createdAt: Date
}

export interface CouponDetails {
  code: string
  clientName: string
  discountPercentage: number
  sentAt: Date | null
  expiresAt: Date | null
  usedAt: Date | null
  usedBy: CouponRedeemer | null
  order: CouponOrderDetails
}

export interface CouponSummary extends CouponDetails {
  sentAt: Date
  expiresAt: Date
}

function couponDetails(coupon: {
  code: string
  discountPercentage: number
  sentAt: Date | null
  expiresAt: Date | null
  usedAt: Date | null
  usedBy?: { name: string | null; email: string; role: string } | null
  order: CouponOrderDetails
}): CouponDetails {
  return {
    code: coupon.code,
    clientName: coupon.order.clientName,
    discountPercentage: coupon.discountPercentage,
    sentAt: coupon.sentAt,
    expiresAt: coupon.expiresAt,
    usedAt: coupon.usedAt,
    usedBy: coupon.usedBy
      ? { name: coupon.usedBy.name, email: coupon.usedBy.email, role: coupon.usedBy.role }
      : null,
    order: coupon.order,
  }
}

export async function lookupCoupon(code: string, now = new Date()): Promise<CouponLookupResult> {
  const normalizedCode = normalizeCouponCode(code)
  if (!normalizedCode) {
    return { valid: false, status: "NOT_FOUND", message: "Código no válido." }
  }

  const coupon = await prisma.coupon.findUnique({
    where: { code: normalizedCode },
    include: {
      order: {
        select: {
          id: true,
          clientName: true,
          clientPhone: true,
          deliveryDate: true,
          deliveryLocation: true,
          comment: true,
          isPaid: true,
          isDelivered: true,
          deliveredAt: true,
          createdAt: true,
        },
      },
      usedBy: { select: { name: true, email: true, role: true } },
    },
  })

  if (!coupon) {
    return { valid: false, status: "NOT_FOUND", message: "Código no válido." }
  }

  if (coupon.usedAt) {
    return {
      valid: false,
      status: "USED",
      message: "Este código ya ha sido utilizado. Estos son los datos de su primer canje:",
      coupon: couponDetails(coupon),
    }
  }

  if (coupon.sendStatus !== CouponSendStatus.SENT || !coupon.sentAt || !coupon.expiresAt) {
    return {
      valid: false,
      status: "PENDING",
      message: "Este código todavía no está activo porque aún no se ha compartido.",
    }
  }

  if (coupon.expiresAt <= now) {
    return {
      valid: false,
      status: "EXPIRED",
      message: `Este código ha caducado porque han pasado ${COUPON_VALIDITY_DAYS} días desde que se compartió. Estos son los datos del encargo asociado:`,
      coupon: couponDetails(coupon),
    }
  }

  return {
    valid: true,
    status: "VALID",
    message: "Código válido.",
    coupon: {
      ...couponDetails(coupon),
      sentAt: coupon.sentAt,
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
