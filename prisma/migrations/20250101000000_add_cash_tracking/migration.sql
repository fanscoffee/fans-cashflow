-- CreateEnum
CREATE TYPE "CashDestination" AS ENUM ('DEPOSITO', 'INGRESO_EN_FONDO', 'GUARDADO');

-- CreateTable
CREATE TABLE "CashTracking" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "destination" "CashDestination" NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashTracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashTracking_shiftId_key" ON "CashTracking"("shiftId");

-- AddForeignKey
ALTER TABLE "CashTracking" ADD CONSTRAINT "CashTracking_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTracking" ADD CONSTRAINT "CashTracking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
