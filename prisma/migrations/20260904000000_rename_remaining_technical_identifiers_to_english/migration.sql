-- Complete the identifier-only rename for legacy constraint and index names.
-- No table data, enum labels, keys, or relationship definitions are changed.

ALTER TABLE "CreditorAccountChange"
  RENAME CONSTRAINT "CambioCuentaCreditor_autorizadoPorId_fkey"
  TO "CreditorAccountChange_authorizedById_fkey";

ALTER TABLE "CreditorAccountChange"
  RENAME CONSTRAINT "CambioCuentaCreditor_creditorId_fkey"
  TO "CreditorAccountChange_creditorId_fkey";

ALTER TABLE "CreditorAccountChange"
  RENAME CONSTRAINT "CambioCuentaCreditor_pkey"
  TO "CreditorAccountChange_pkey";

ALTER TABLE "CreditorAccountChange"
  RENAME CONSTRAINT "CambioCuentaCreditor_requestedById_fkey"
  TO "CreditorAccountChange_requestedById_fkey";

ALTER TABLE "CurrentExpense"
  RENAME CONSTRAINT "CurrentExpense_categoriaId_fkey"
  TO "CurrentExpense_categoryId_fkey";

ALTER TABLE "FundsMovement"
  RENAME CONSTRAINT "FundsMovement_pagoId_fkey"
  TO "FundsMovement_paymentId_fkey";

ALTER TABLE "PaymentApplication"
  RENAME CONSTRAINT "PaymentApplication_pagoId_fkey"
  TO "PaymentApplication_paymentId_fkey";

ALTER TABLE "PaymentApproval"
  RENAME CONSTRAINT "PaymentApproval_pagoId_fkey"
  TO "PaymentApproval_paymentId_fkey";

ALTER TABLE "PaymentAttachment"
  RENAME CONSTRAINT "PaymentAttachment_factura_required_chk"
  TO "PaymentAttachment_invoiceId_required_chk";

ALTER TABLE "PaymentSequence"
  RENAME CONSTRAINT "SecuenciaPayment_pkey"
  TO "PaymentSequence_pkey";

ALTER TABLE "RecurringContract"
  RENAME CONSTRAINT "RecurringContract_categoriaId_fkey"
  TO "RecurringContract_categoryId_fkey";

ALTER TABLE "StatementMovement"
  RENAME CONSTRAINT "StatementMovement_pagoId_fkey"
  TO "StatementMovement_paymentId_fkey";

ALTER TABLE "SupplierProduct"
  RENAME CONSTRAINT "ProveedorProduct_pkey"
  TO "SupplierProduct_pkey";

ALTER TABLE "SupplierProduct"
  RENAME CONSTRAINT "ProveedorProduct_productId_fkey"
  TO "SupplierProduct_productId_fkey";

ALTER TABLE "SupplierProduct"
  RENAME CONSTRAINT "ProveedorProduct_supplierId_fkey"
  TO "SupplierProduct_supplierId_fkey";

DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('AccountingInvoice_nif_facturaNumero_idx', 'AccountingInvoice_taxId_invoiceNumber_idx'),
      ('CloseMetric_cierreId_code_key', 'CloseMetric_closeId_code_key'),
      ('CambioCuentaCreditor_creditorId_status_idx', 'CreditorAccountChange_creditorId_status_idx'),
      ('CurrentExpense_creditorId_categoriaId_accrualDate_idx', 'CurrentExpense_creditorId_categoryId_accrualDate_idx'),
      ('Invoice_estadoPayment_idx', 'Invoice_paymentStatus_idx'),
      ('Payment_entity_status_fechaPayment_idx', 'Payment_entity_status_paymentDate_idx'),
      ('PhysicalInventory_fechaConteo_idx', 'PhysicalInventory_countedAt_idx'),
      ('PhysicalInventory_fechaConteo_key', 'PhysicalInventory_countedAt_key'),
      ('PhysicalInventoryLine_inventarioFisicoId_idx', 'PhysicalInventoryLine_physicalInventoryId_idx'),
      ('PhysicalInventoryLine_inventarioFisicoId_productId_key', 'PhysicalInventoryLine_physicalInventoryId_productId_key'),
      ('Receipt_fechaReceipt_idx', 'Receipt_receivedAt_idx'),
      ('ReceiptLine_recepcionId_idx', 'ReceiptLine_receiptId_idx'),
      ('ProveedorProduct_productId_idx', 'SupplierProduct_productId_idx'),
      ('ProveedorProduct_supplierId_productId_key', 'SupplierProduct_supplierId_productId_key')
    ) AS names(old_name, new_name)
  LOOP
    IF to_regclass(format('public.%I', item.old_name)) IS NOT NULL THEN
      EXECUTE format('ALTER INDEX public.%I RENAME TO %I', item.old_name, item.new_name);
    END IF;
  END LOOP;
END $$;
