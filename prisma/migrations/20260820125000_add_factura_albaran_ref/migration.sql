ALTER TABLE "Factura" ADD COLUMN "referenciaAlbaran" TEXT;
ALTER TABLE "Factura" ADD COLUMN "fechaAlbaran" TIMESTAMP(3);

CREATE INDEX "Factura_fechaAlbaran_idx" ON "Factura"("fechaAlbaran");
