-- AdjuntoPago queda reservado para documentos de factura.
ALTER TABLE "AdjuntoPago"
  ADD CONSTRAINT "AdjuntoPago_factura_required_chk"
  CHECK ("facturaId" IS NOT NULL);
