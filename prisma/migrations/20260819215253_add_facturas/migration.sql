-- AlterTable
ALTER TABLE "Recepcion" ADD COLUMN     "facturaId" TEXT;

-- CreateTable
CREATE TABLE "Factura" (
    "id" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "serie" TEXT NOT NULL DEFAULT '',
    "numero" TEXT NOT NULL,
    "fechaExpedicion" TIMESTAMP(3) NOT NULL,
    "fechaOperacion" TIMESTAMP(3),
    "fechaVencimiento" TIMESTAMP(3),
    "fechaPago" TIMESTAMP(3),
    "formaPago" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'CONFIRMADA',
    "estadoPago" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "moneda" TEXT NOT NULL DEFAULT 'EUR',
    "importePagado" DECIMAL(12,2),
    "razonSocialEmisor" TEXT NOT NULL,
    "nifEmisor" TEXT NOT NULL,
    "domicilioFiscalEmisor" TEXT NOT NULL,
    "totalNeto" DECIMAL(12,2) NOT NULL,
    "totalIva" DECIMAL(12,2) NOT NULL,
    "totalRecargo" DECIMAL(12,2) NOT NULL,
    "totalRetenciones" DECIMAL(12,2) NOT NULL,
    "importeTotal" DECIMAL(12,2) NOT NULL,
    "observaciones" TEXT,
    "alertas" JSONB,
    "confirmadoPorId" TEXT NOT NULL,
    "confirmadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Factura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacturaLinea" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "productoId" TEXT,
    "tipoLinea" TEXT NOT NULL DEFAULT 'PRODUCTO',
    "referenciaProveedor" TEXT,
    "descripcion" TEXT NOT NULL,
    "unidadMedida" TEXT,
    "formatoOriginal" TEXT,
    "cantidad" DECIMAL(12,4) NOT NULL,
    "descuentoPorcentaje" DECIMAL(7,4),
    "descuentoImporte" DECIMAL(12,2) NOT NULL,
    "precioUnitario" DECIMAL(12,4) NOT NULL,
    "precioUnitarioNeto" DECIMAL(12,4) NOT NULL,
    "baseImponible" DECIMAL(12,2) NOT NULL,
    "tipoIva" DECIMAL(7,4),
    "cuotaIva" DECIMAL(12,2) NOT NULL,
    "totalLinea" DECIMAL(12,2) NOT NULL,
    "lote" TEXT,
    "fechaVencimiento" TIMESTAMP(3),
    "alertaValidacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacturaLinea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacturaImpuesto" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "porcentaje" DECIMAL(7,4),
    "baseImponible" DECIMAL(12,2) NOT NULL,
    "cuota" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacturaImpuesto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Factura_fechaExpedicion_idx" ON "Factura"("fechaExpedicion");

-- CreateIndex
CREATE INDEX "Factura_estado_idx" ON "Factura"("estado");

-- CreateIndex
CREATE INDEX "Factura_estadoPago_idx" ON "Factura"("estadoPago");

-- CreateIndex
CREATE UNIQUE INDEX "Factura_proveedorId_serie_numero_key" ON "Factura"("proveedorId", "serie", "numero");

-- CreateIndex
CREATE INDEX "FacturaLinea_facturaId_idx" ON "FacturaLinea"("facturaId");

-- CreateIndex
CREATE INDEX "FacturaLinea_productoId_idx" ON "FacturaLinea"("productoId");

-- CreateIndex
CREATE INDEX "FacturaImpuesto_facturaId_idx" ON "FacturaImpuesto"("facturaId");

-- CreateIndex
CREATE INDEX "FacturaImpuesto_tipo_idx" ON "FacturaImpuesto"("tipo");

-- CreateIndex
CREATE INDEX "Recepcion_facturaId_idx" ON "Recepcion"("facturaId");

-- AddForeignKey
ALTER TABLE "Recepcion" ADD CONSTRAINT "Recepcion_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_confirmadoPorId_fkey" FOREIGN KEY ("confirmadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaLinea" ADD CONSTRAINT "FacturaLinea_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaLinea" ADD CONSTRAINT "FacturaLinea_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaImpuesto" ADD CONSTRAINT "FacturaImpuesto_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE CASCADE ON UPDATE CASCADE;
