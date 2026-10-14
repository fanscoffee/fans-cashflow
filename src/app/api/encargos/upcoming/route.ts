import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

export const GET = withAuth(async (_req, session) => {
  const canManageCoupons = hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(23, 59, 59, 999)

  const include = {
    createdBy: { select: { name: true, email: true } },
    ...(canManageCoupons && {
      coupon: {
        select: {
          code: true,
          discountPercentage: true,
          scheduledFor: true,
          sendStatus: true,
          sentAt: true,
          expiresAt: true,
          usedAt: true,
        },
      },
    }),
  }

  const orders = await prisma.order.findMany({
    where: { deliveryDate: { gte: today, lte: tomorrow } },
    include,
    orderBy: { deliveryDate: "asc" },
  })

  return NextResponse.json(orders)
})
