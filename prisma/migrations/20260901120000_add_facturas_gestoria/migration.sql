-- CreateEnum
CREATE TYPE "OrigenFacturaGestoria" AS ENUM ('OCR', 'MANUAL');

-- CreateTable
CREATE TABLE "FacturaGestoria" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "facturaNumero" TEXT NOT NULL DEFAULT '',
    "proveedorAcreedor" TEXT NOT NULL,
    "nif" TEXT NOT NULL DEFAULT '',
    "concepto" TEXT NOT NULL DEFAULT '',
    "baseExenta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "base21" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iva21" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "base10" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iva10" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "base4" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iva4" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "base2" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iva2" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalBase" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalIva" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "irpf" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalFactura" DECIMAL(12,2) NOT NULL,
    "formaPago" TEXT NOT NULL DEFAULT '',
    "textoOCR" TEXT,
    "origen" "OrigenFacturaGestoria" NOT NULL DEFAULT 'MANUAL',
    "alertas" JSONB,
    "creadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacturaGestoria_pkey" PRIMARY KEY ("id")
);

-- Keep this internal table unavailable through Supabase Data API by default.
ALTER TABLE "FacturaGestoria" ENABLE ROW LEVEL SECURITY;

-- CreateIndex
CREATE INDEX "FacturaGestoria_fecha_idx" ON "FacturaGestoria"("fecha");

-- CreateIndex
CREATE INDEX "FacturaGestoria_nif_facturaNumero_idx" ON "FacturaGestoria"("nif", "facturaNumero");

-- CreateIndex
CREATE INDEX "FacturaGestoria_creadoPorId_idx" ON "FacturaGestoria"("creadoPorId");

-- AddForeignKey
ALTER TABLE "FacturaGestoria" ADD CONSTRAINT "FacturaGestoria_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
