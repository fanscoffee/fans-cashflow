-- CreateTable
CREATE TABLE "CierreTurno" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "numeroCierreCaja" TEXT NOT NULL,
    "tpv" TEXT NOT NULL,
    "fechaHoraApertura" TIMESTAMP(3) NOT NULL,
    "fechaHoraCierre" TIMESTAMP(3) NOT NULL,
    "fondoCajaAnterior" DECIMAL(12,2) NOT NULL,
    "cobrosEfectivo" DECIMAL(12,2) NOT NULL,
    "reembolsosEfectivo" DECIMAL(12,2) NOT NULL,
    "depositado" DECIMAL(12,2) NOT NULL,
    "pagosSalidas" DECIMAL(12,2) NOT NULL,
    "efectivoTeoricoCaja" DECIMAL(12,2) NOT NULL,
    "cantidadEfectivoReal" DECIMAL(12,2) NOT NULL,
    "descuadre" DECIMAL(12,2) NOT NULL,
    "ventasBrutas" DECIMAL(12,2) NOT NULL,
    "reembolsos" DECIMAL(12,2) NOT NULL,
    "descuentos" DECIMAL(12,2) NOT NULL,
    "ventasNetas" DECIMAL(12,2) NOT NULL,
    "ventasEfectivo" DECIMAL(12,2) NOT NULL,
    "ventasTarjeta" DECIMAL(12,2) NOT NULL,
    "ivaPan4Base" DECIMAL(12,2) NOT NULL,
    "ivaPan4Cuota" DECIMAL(12,2) NOT NULL,
    "iva10Base" DECIMAL(12,2) NOT NULL,
    "iva10Cuota" DECIMAL(12,2) NOT NULL,
    "observacionDescuadre" TEXT,
    "confirmadoPorId" TEXT NOT NULL,
    "confirmadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CierreTurno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CierreTurno_shiftId_key" ON "CierreTurno"("shiftId");

-- CreateIndex
CREATE INDEX "CierreTurno_confirmadoAt_idx" ON "CierreTurno"("confirmadoAt");

-- CreateIndex
CREATE UNIQUE INDEX "CierreTurno_tpv_numeroCierreCaja_key" ON "CierreTurno"("tpv", "numeroCierreCaja");

-- AddForeignKey
ALTER TABLE "CierreTurno" ADD CONSTRAINT "CierreTurno_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreTurno" ADD CONSTRAINT "CierreTurno_confirmadoPorId_fkey" FOREIGN KEY ("confirmadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
