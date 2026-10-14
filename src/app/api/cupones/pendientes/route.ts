import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { CouponSendStatus, UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

const shareableStatuses: CouponSendStatus[] = [
  CouponSendStatus.PENDING,
  CouponSendStatus.SENDING,
  CouponSendStatus.FAILED,
]

export const GET = withAuth(async (_req, session) => {
  const canManageCoupons = hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])
  const where = {
    usedAt: null,
    sendStatus: { in: shareableStatuses },
    order: { isDelivered: true },
  }

  if (!canManageCoupons) {
    const count = await prisma.coupon.count({ where })
    return NextResponse.json({ canManageCoupons: false, count, coupons: [] })
  }

  const coupons = await prisma.coupon.findMany({
    where,
    select: {
      id: true,
      code: true,
      discountPercentage: true,
      scheduledFor: true,
      sendStatus: true,
      lastError: true,
      order: {
        select: {
          clientName: true,
          clientPhone: true,
        },
      },
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
  })

  return NextResponse.json({
    canManageCoupons: true,
    count: coupons.length,
    coupons: coupons.map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      discountPercentage: coupon.discountPercentage,
      scheduledFor: coupon.scheduledFor,
      sendStatus: coupon.sendStatus,
      lastError: coupon.lastError,
      clientName: coupon.order.clientName,
      clientPhone: coupon.order.clientPhone,
    })),
  })
})
