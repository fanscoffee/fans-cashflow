-- Normalize the remaining mixed-language constraint and index names.
-- This migration changes identifiers only; it does not modify table rows or values.

ALTER TABLE "Advance"
  RENAME CONSTRAINT "Advance_autorizadoPorId_fkey"
  TO "Advance_authorizedById_fkey";

ALTER TABLE "CashReplenishment"
  RENAME CONSTRAINT "CashReplenishment_creadaPorId_fkey"
  TO "CashReplenishment_createdById_fkey";

ALTER TABLE "RecurringContract"
  RENAME CONSTRAINT "RecurringContract_autorizadoPorId_fkey"
  TO "RecurringContract_authorizedById_fkey";

ALTER TABLE "StatementImport"
  RENAME CONSTRAINT "StatementImport_creadaPorId_fkey"
  TO "StatementImport_createdById_fkey";

ALTER INDEX "AccountingInvoice_creadoPorId_idx"
  RENAME TO "AccountingInvoice_createdById_idx";

ALTER INDEX "CashReplenishment_arqueoId_key"
  RENAME TO "CashReplenishment_cashCountId_key";

ALTER INDEX "Creditor_nif_idx"
  RENAME TO "Creditor_taxId_idx";

ALTER INDEX "MonthlyClose_entity_anio_mes_key"
  RENAME TO "MonthlyClose_entity_year_month_key";

ALTER INDEX "MonthlyClose_status_anio_mes_idx"
  RENAME TO "MonthlyClose_status_year_month_idx";

ALTER INDEX "Receipt_codigoAlbaran_supplierId_key"
  RENAME TO "Receipt_deliveryNoteCode_supplierId_key";

ALTER INDEX "ShiftClose_tpv_cashCloseNumber_key"
  RENAME TO "ShiftClose_pos_cashCloseNumber_key";

ALTER INDEX "StatementImport_fundsAccountId_hashArchivo_key"
  RENAME TO "StatementImport_fundsAccountId_fileHash_key";

ALTER INDEX "StatementMovement_referenciaExterna_idx"
  RENAME TO "StatementMovement_externalReference_idx";
