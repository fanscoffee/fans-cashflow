import { Prisma } from "@/generated/prisma/client"
import { CouponSendStatus } from "@/lib/database-enums"
import { generateCouponCode, getCouponDiscountPercentage } from "@/lib/coupons"

export async function scheduleCouponForOrder(
  tx: Prisma.TransactionClient,
  {
    orderId,
    clientName,
    deliveredAt,
  }: {
    orderId: string
    clientName: string
    deliveredAt: Date
  }
) {
  const existing = await tx.coupon.findUnique({ where: { orderId } })

  if (existing) {
    if (!existing.sentAt && !existing.usedAt && existing.sendStatus !== CouponSendStatus.SENDING) {
      return tx.coupon.update({
        where: { id: existing.id },
        data: {
          scheduledFor: deliveredAt,
          nextAttemptAt: null,
          sendStatus: CouponSendStatus.PENDING,
          lastError: null,
        },
      })
    }
    return existing
  }

  return tx.coupon.create({
    data: {
      code: generateCouponCode(clientName),
      orderId,
      discountPercentage: getCouponDiscountPercentage(),
      scheduledFor: deliveredAt,
      nextAttemptAt: null,
    },
  })
}
