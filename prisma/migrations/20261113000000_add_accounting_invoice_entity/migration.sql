-- AlterTable
ALTER TABLE "AccountingInvoice"
  ADD COLUMN "entity" "PaymentEntity" NOT NULL DEFAULT 'OBRADOR';

-- CreateIndex
CREATE INDEX "AccountingInvoice_entity_date_idx"
  ON "AccountingInvoice"("entity", "date");
