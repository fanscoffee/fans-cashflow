-- CreateTable
CREATE TABLE "InventarioFisico" (
    "id" TEXT NOT NULL,
    "fechaConteo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoById" TEXT NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventarioFisico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventarioFisicoLinea" (
    "id" TEXT NOT NULL,
    "inventarioFisicoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidadUm1" DECIMAL(10,2) NOT NULL,
    "cantidadUm2" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventarioFisicoLinea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventarioFisico_fechaConteo_idx" ON "InventarioFisico"("fechaConteo");

-- CreateIndex
CREATE UNIQUE INDEX "InventarioFisico_fechaConteo_key" ON "InventarioFisico"("fechaConteo");

-- CreateIndex
CREATE INDEX "InventarioFisicoLinea_inventarioFisicoId_idx" ON "InventarioFisicoLinea"("inventarioFisicoId");

-- CreateIndex
CREATE INDEX "InventarioFisicoLinea_productoId_idx" ON "InventarioFisicoLinea"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "InventarioFisicoLinea_inventarioFisicoId_productoId_key" ON "InventarioFisicoLinea"("inventarioFisicoId", "productoId");

-- AddForeignKey
ALTER TABLE "InventarioFisico" ADD CONSTRAINT "InventarioFisico_creadoById_fkey" FOREIGN KEY ("creadoById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventarioFisicoLinea" ADD CONSTRAINT "InventarioFisicoLinea_inventarioFisicoId_fkey" FOREIGN KEY ("inventarioFisicoId") REFERENCES "InventarioFisico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventarioFisicoLinea" ADD CONSTRAINT "InventarioFisicoLinea_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
