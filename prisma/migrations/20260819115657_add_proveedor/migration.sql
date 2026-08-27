/*
  Warnings:

  - You are about to drop the column `codProveedor` on the `Producto` table. All the data in the column will be lost.
  - You are about to drop the column `pedidoMinimo` on the `Producto` table. All the data in the column will be lost.
  - You are about to drop the column `plazoEntregaDias` on the `Producto` table. All the data in the column will be lost.
  - You are about to drop the column `precioCompraSinIva` on the `Producto` table. All the data in the column will be lost.
  - You are about to drop the column `refProveedor` on the `Producto` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Producto" DROP COLUMN "codProveedor",
DROP COLUMN "pedidoMinimo",
DROP COLUMN "plazoEntregaDias",
DROP COLUMN "precioCompraSinIva",
DROP COLUMN "refProveedor";

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "cifNif" TEXT NOT NULL,
    "direccionFiscal" TEXT,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "contactoEmail" TEXT,
    "iban" TEXT,
    "categoriaServicio" TEXT,
    "condicionesPago" TEXT,
    "plazoEntregaDias" INTEGER,
    "pedidoMinimo" DECIMAL(10,3),
    "notasCondiciones" TEXT,
    "frecuenciaEntrega" TEXT,
    "horarioEntrega" TEXT,
    "metodoPedido" TEXT,
    "fechaAlta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'Activo',
    "valoracionFiabilidad" INTEGER,
    "valoracionCalidad" INTEGER,
    "valoracionPrecio" INTEGER,
    "incidencias" TEXT,
    "observaciones" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProveedorProducto" (
    "id" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "refProveedor" TEXT,
    "precioCompraSinIva" DECIMAL(10,4),
    "plazoEntregaDias" INTEGER,
    "pedidoMinimo" DECIMAL(10,3),
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProveedorProducto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_cifNif_key" ON "Proveedor"("cifNif");

-- CreateIndex
CREATE INDEX "Proveedor_estado_idx" ON "Proveedor"("estado");

-- CreateIndex
CREATE INDEX "ProveedorProducto_productoId_idx" ON "ProveedorProducto"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "ProveedorProducto_proveedorId_productoId_key" ON "ProveedorProducto"("proveedorId", "productoId");

-- AddForeignKey
ALTER TABLE "Proveedor" ADD CONSTRAINT "Proveedor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorProducto" ADD CONSTRAINT "ProveedorProducto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorProducto" ADD CONSTRAINT "ProveedorProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
