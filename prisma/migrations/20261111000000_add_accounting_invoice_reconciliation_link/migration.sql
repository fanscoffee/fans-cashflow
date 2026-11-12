-- Add the optional bridge between a Gestoría capture and the operational invoice.
-- Existing captures remain unlinked and existing receipts are not reassigned.

CREATE TYPE "AccountingReconciliationStatus" AS ENUM (
  'SIN_VINCULAR',
  'SUGERIDA',
  'VINCULADA',
  'CON_INCIDENCIA',
  'NO_APLICA'
);

ALTER TABLE "AccountingInvoice"
  ADD COLUMN "documentType" "PaymentDocumentType",
  ADD COLUMN "inventoryInvoiceId" TEXT,
  ADD COLUMN "linkedAt" TIMESTAMP(3),
  ADD COLUMN "linkedById" TEXT,
  ADD COLUMN "reconciliationStatus" "AccountingReconciliationStatus" NOT NULL DEFAULT 'SIN_VINCULAR',
  ADD COLUMN "supplierId" TEXT;

CREATE UNIQUE INDEX "AccountingInvoice_inventoryInvoiceId_key"
  ON "AccountingInvoice"("inventoryInvoiceId");

CREATE INDEX "AccountingInvoice_supplierId_reconciliationStatus_date_idx"
  ON "AccountingInvoice"("supplierId", "reconciliationStatus", "date");

CREATE INDEX "AccountingInvoice_reconciliationStatus_createdAt_idx"
  ON "AccountingInvoice"("reconciliationStatus", "createdAt");

CREATE INDEX "AccountingInvoice_linkedById_idx"
  ON "AccountingInvoice"("linkedById");

ALTER TABLE "AccountingInvoice"
  ADD CONSTRAINT "AccountingInvoice_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccountingInvoice"
  ADD CONSTRAINT "AccountingInvoice_inventoryInvoiceId_fkey"
  FOREIGN KEY ("inventoryInvoiceId") REFERENCES "Invoice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccountingInvoice"
  ADD CONSTRAINT "AccountingInvoice_linkedById_fkey"
  FOREIGN KEY ("linkedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
