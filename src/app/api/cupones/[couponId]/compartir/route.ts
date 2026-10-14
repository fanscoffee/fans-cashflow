import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { CouponSendStatus, UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"
import { expireCouponAt } from "@/lib/coupons"

const shareableStatuses: CouponSendStatus[] = [
  CouponSendStatus.PENDING,
  CouponSendStatus.SENDING,
  CouponSendStatus.FAILED,
]

export const POST = withAuth(async (_req, session, context) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { couponId } = await context.params
  const existing = await prisma.coupon.findUnique({
    where: { id: couponId },
    select: {
      id: true,
      sendStatus: true,
      sentAt: true,
      expiresAt: true,
      usedAt: true,
      order: { select: { isDelivered: true } },
    },
  })

  if (!existing) return NextResponse.json({ error: "Cupón no encontrado" }, { status: 404 })
  if (existing.usedAt) return NextResponse.json({ error: "El cupón ya fue utilizado" }, { status: 409 })
  if (!existing.order.isDelivered) return NextResponse.json({ error: "El encargo aún no está entregado" }, { status: 409 })
  if (existing.sendStatus === CouponSendStatus.SENT && existing.sentAt && existing.expiresAt) {
    return NextResponse.json({ id: existing.id, sentAt: existing.sentAt, expiresAt: existing.expiresAt })
  }
  if (!shareableStatuses.includes(existing.sendStatus)) {
    return NextResponse.json({ error: "El cupón no se puede compartir" }, { status: 409 })
  }

  const sentAt = new Date()
  const expiresAt = expireCouponAt(sentAt)
  const updated = await prisma.coupon.updateMany({
    where: {
      id: couponId,
      usedAt: null,
      sendStatus: { in: shareableStatuses },
    },
    data: {
      sendStatus: CouponSendStatus.SENT,
      sentAt,
      expiresAt,
      nextAttemptAt: null,
      lastError: null,
    },
  })

  if (updated.count !== 1) {
    return NextResponse.json({ error: "El cupón cambió mientras se compartía" }, { status: 409 })
  }

  return NextResponse.json({ id: couponId, sentAt, expiresAt })
})
