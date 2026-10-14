import { Prisma } from "@/generated/prisma/client"
import { CouponSendStatus } from "@/lib/database-enums"
import { generateCouponCode, getCouponDiscountPercentage } from "@/lib/coupons"

const MAX_CODE_GENERATION_ATTEMPTS = 10

export async function scheduleCouponForOrder(
  tx: Prisma.TransactionClient,
  {
    orderId,
    deliveredAt,
  }: {
    orderId: string
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

  let code: string | null = null
  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = generateCouponCode()
    const existingCode = await tx.coupon.findUnique({ where: { code: candidate }, select: { id: true } })
    if (!existingCode) {
      code = candidate
      break
    }
  }

  if (!code) throw new Error("No se pudo generar un código de cupón único")

  return tx.coupon.create({
    data: {
      code,
      orderId,
      discountPercentage: getCouponDiscountPercentage(),
      scheduledFor: deliveredAt,
      nextAttemptAt: null,
    },
  })
}
