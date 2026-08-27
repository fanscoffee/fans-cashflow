ALTER TABLE "Factura" ADD COLUMN "numeroPedido" TEXT;
ALTER TABLE "Factura" ADD COLUMN "fechaPedido" TIMESTAMP(3);
ALTER TABLE "Factura" ADD COLUMN "centroEntrega" TEXT;

CREATE INDEX "Factura_fechaPedido_idx" ON "Factura"("fechaPedido");
