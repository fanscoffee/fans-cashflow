import { Prisma } from "@/generated/prisma/client"
import { CouponSendStatus } from "@/lib/database-enums"
import { prisma } from "@/lib/prisma"
import {
  expireCouponAt,
  generateCouponCode,
  getCouponDiscountPercentage,
  nextCouponAttemptAt,
  scheduleCouponAt,
} from "@/lib/coupons"
import { sendCouponWhatsAppMessage } from "@/lib/whatsapp"

const STALE_SENDING_AFTER_MS = 10 * 60 * 1000
const DEFAULT_BATCH_SIZE = 25

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
  const scheduledFor = scheduleCouponAt(deliveredAt)
  const existing = await tx.coupon.findUnique({ where: { orderId } })

  if (existing) {
    if (!existing.sentAt && !existing.usedAt && existing.sendStatus !== CouponSendStatus.SENDING) {
      return tx.coupon.update({
        where: { id: existing.id },
        data: {
          scheduledFor,
          nextAttemptAt: scheduledFor,
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
      scheduledFor,
      nextAttemptAt: scheduledFor,
    },
  })
}

function retryableCouponWhere(now: Date, staleSendingAt: Date): Prisma.CouponWhereInput {
  return {
    usedAt: null,
    order: { isDelivered: true },
    OR: [
      {
        sendStatus: { in: [CouponSendStatus.PENDING, CouponSendStatus.FAILED] },
        nextAttemptAt: { lte: now },
      },
      {
        sendStatus: CouponSendStatus.SENDING,
        lastAttemptAt: { lte: staleSendingAt },
      },
    ],
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500)
  return "Error desconocido al enviar el cupón"
}

export async function processPendingCoupons(limit = DEFAULT_BATCH_SIZE, now = new Date()) {
  const batchSize = Math.max(1, Math.min(Math.trunc(limit), 100))
  const staleSendingAt = new Date(now.getTime() - STALE_SENDING_AFTER_MS)
  const candidates = await prisma.coupon.findMany({
    where: retryableCouponWhere(now, staleSendingAt),
    include: {
      order: { select: { clientName: true, clientPhone: true } },
    },
    orderBy: { scheduledFor: "asc" },
    take: batchSize,
  })

  let sent = 0
  let failed = 0

  for (const candidate of candidates) {
    const claimed = await prisma.coupon.updateMany({
      where: {
        id: candidate.id,
        ...retryableCouponWhere(now, staleSendingAt),
      },
      data: {
        sendStatus: CouponSendStatus.SENDING,
        lastAttemptAt: now,
        sendAttempts: { increment: 1 },
      },
    })

    if (claimed.count !== 1) continue

    try {
      const sentAt = new Date()
      const expiresAt = expireCouponAt(sentAt)
      await sendCouponWhatsAppMessage({
        clientName: candidate.order.clientName,
        clientPhone: candidate.order.clientPhone,
        code: candidate.code,
        expiresAt,
      })
      await prisma.coupon.updateMany({
        where: { id: candidate.id, sendStatus: CouponSendStatus.SENDING },
        data: {
          sendStatus: CouponSendStatus.SENT,
          sentAt,
          expiresAt,
          nextAttemptAt: null,
          lastError: null,
        },
      })
      sent += 1
    } catch (error) {
      await prisma.coupon.updateMany({
        where: { id: candidate.id, sendStatus: CouponSendStatus.SENDING },
        data: {
          sendStatus: CouponSendStatus.FAILED,
          nextAttemptAt: nextCouponAttemptAt(now, candidate.sendAttempts + 1),
          lastError: errorMessage(error),
        },
      })
      failed += 1
    }
  }

  return {
    considered: candidates.length,
    sent,
    failed,
    skipped: candidates.length - sent - failed,
  }
}
