-- CreateTable
CREATE TABLE "Catalogo" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Catalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "codBarrasEan" TEXT,
    "descripcionTpv" TEXT NOT NULL,
    "descripcionCompleta" TEXT NOT NULL,
    "tipoArticulo" TEXT NOT NULL,
    "familia" TEXT NOT NULL,
    "subfamilia" TEXT,
    "seccion" TEXT NOT NULL,
    "esComprable" BOOLEAN NOT NULL DEFAULT false,
    "esElaborado" BOOLEAN NOT NULL DEFAULT false,
    "esVendible" BOOLEAN NOT NULL DEFAULT false,
    "llevaReceta" BOOLEAN NOT NULL DEFAULT false,
    "umBaseStock" TEXT NOT NULL,
    "umCompra" TEXT,
    "factorCompraABase" DECIMAL(12,6),
    "umVenta" TEXT,
    "factorVentaABase" DECIMAL(12,6),
    "pesoNetoUdG" DECIMAL(10,2),
    "formatoPresentacion" TEXT,
    "codProveedor" TEXT,
    "refProveedor" TEXT,
    "precioCompraSinIva" DECIMAL(10,4),
    "costeUmBase" DECIMAL(10,4),
    "plazoEntregaDias" INTEGER,
    "pedidoMinimo" DECIMAL(10,3),
    "mermaEstandarPct" DECIMAL(5,2),
    "codIva" TEXT NOT NULL,
    "ivaPct" DECIMAL(5,2),
    "metodoPrecio" TEXT NOT NULL,
    "margenObjetivoPct" DECIMAL(5,2),
    "pvpObjetivoConIva" DECIMAL(10,4),
    "pvpFijoConIva" DECIMAL(10,4),
    "pvpAplicadoConIva" DECIMAL(10,4),
    "pvpAplicadoSinIva" DECIMAL(10,4),
    "margenRealPct" DECIMAL(5,2),
    "desviacionPp" DECIMAL(5,2),
    "diferenciaEurUd" DECIMAL(10,4),
    "diagnosticoPrecio" TEXT,
    "controlaStock" TEXT NOT NULL DEFAULT 'SI',
    "metodoValoracion" TEXT NOT NULL,
    "stockMinimo" DECIMAL(10,3),
    "stockMaximo" DECIMAL(10,3),
    "puntoPedido" DECIMAL(10,3),
    "ubicacion" TEXT,
    "claseAbc" TEXT,
    "controlLote" TEXT NOT NULL DEFAULT 'NO',
    "vidaUtilDias" INTEGER,
    "conservacion" TEXT,
    "alergenos" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'Activo',
    "fechaAlta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "esEjemplo" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Catalogo_tipo_idx" ON "Catalogo"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Catalogo_tipo_valor_key" ON "Catalogo"("tipo", "valor");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigo_key" ON "Producto"("codigo");

-- CreateIndex
CREATE INDEX "Producto_tipoArticulo_idx" ON "Producto"("tipoArticulo");

-- CreateIndex
CREATE INDEX "Producto_familia_idx" ON "Producto"("familia");

-- CreateIndex
CREATE INDEX "Producto_seccion_idx" ON "Producto"("seccion");

-- CreateIndex
CREATE INDEX "Producto_estado_idx" ON "Producto"("estado");

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
