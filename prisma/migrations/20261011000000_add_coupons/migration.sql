-- CreateEnum
CREATE TYPE "CouponSendStatus" AS ENUM ('PENDIENTE', 'ENVIANDO', 'ENVIADO', 'ERROR');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "deliveredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "discountPercentage" INTEGER NOT NULL DEFAULT 15,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sendStatus" "CouponSendStatus" NOT NULL DEFAULT 'PENDIENTE',
    "sentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "sendAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "usedAt" TIMESTAMP(3),
    "usedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_orderId_key" ON "Coupon"("orderId");

-- CreateIndex
CREATE INDEX "Coupon_sendStatus_nextAttemptAt_idx" ON "Coupon"("sendStatus", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "Coupon_expiresAt_usedAt_idx" ON "Coupon"("expiresAt", "usedAt");

-- CreateIndex
CREATE INDEX "Coupon_usedById_idx" ON "Coupon"("usedById");

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
