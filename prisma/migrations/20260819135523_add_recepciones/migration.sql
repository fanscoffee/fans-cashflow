-- CreateTable
CREATE TABLE "Recepcion" (
    "id" TEXT NOT NULL,
    "codigoAlbaran" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "fechaRecepcion" TIMESTAMP(3) NOT NULL,
    "recibidoById" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recepcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecepcionLinea" (
    "id" TEXT NOT NULL,
    "recepcionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidadRecibida" DECIMAL(10,2) NOT NULL,
    "precioUnitario" DECIMAL(10,4) NOT NULL,
    "lote" TEXT,
    "fechaVencimiento" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecepcionLinea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recepcion_proveedorId_idx" ON "Recepcion"("proveedorId");

-- CreateIndex
CREATE INDEX "Recepcion_fechaRecepcion_idx" ON "Recepcion"("fechaRecepcion");

-- CreateIndex
CREATE UNIQUE INDEX "Recepcion_codigoAlbaran_proveedorId_key" ON "Recepcion"("codigoAlbaran", "proveedorId");

-- CreateIndex
CREATE INDEX "RecepcionLinea_recepcionId_idx" ON "RecepcionLinea"("recepcionId");

-- CreateIndex
CREATE INDEX "RecepcionLinea_productoId_idx" ON "RecepcionLinea"("productoId");

-- AddForeignKey
ALTER TABLE "Recepcion" ADD CONSTRAINT "Recepcion_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recepcion" ADD CONSTRAINT "Recepcion_recibidoById_fkey" FOREIGN KEY ("recibidoById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecepcionLinea" ADD CONSTRAINT "RecepcionLinea_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "Recepcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecepcionLinea" ADD CONSTRAINT "RecepcionLinea_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
