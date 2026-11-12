export const REQUIRED_RECONCILIATION_COLUMNS = [
  "documentType",
  "inventoryInvoiceId",
  "linkedAt",
  "linkedById",
  "reconciliationStatus",
  "supplierId",
] as const

export const RECONCILIATION_BRIDGE_INDEX = "AccountingInvoice_inventoryInvoiceId_key"

export type DuplicateCaptureDetail = {
  id: string
  date: string
  supplierOrCreditor: string
  invoiceTotal: number | string
  createdAt: string
}

export type ReconciliationPreflightInput = {
  presentColumns: string[]
  presentIndexes: string[]
  counts: {
    receipts: number
    invoices: number
    accountingCaptures: number
    linkedCaptures: number
    linkedReceipts: number
  }
  integrity: {
    orphanedCaptureLinks: number
    orphanedReceiptLinks: number
    linkedStatusIssues: number
  }
  duplicateKeys: Array<{
    taxId: string
    invoiceNumber: string
    captureIds: string[]
    captures: DuplicateCaptureDetail[]
  }>
}

export type ReconciliationPreflightReport = {
  generatedAt: string
  readOnly: true
  status: "READY" | "WARNINGS" | "BLOCKED"
  schema: {
    migrationReady: boolean
    missingColumns: string[]
    bridgeUniqueIndexPresent: boolean
  }
  counts: ReconciliationPreflightInput["counts"]
  integrity: ReconciliationPreflightInput["integrity"]
  duplicateKeys: ReconciliationPreflightInput["duplicateKeys"]
  blockers: string[]
  warnings: string[]
}

export function buildReconciliationPreflightReport(
  input: ReconciliationPreflightInput,
): ReconciliationPreflightReport {
  const missingColumns = REQUIRED_RECONCILIATION_COLUMNS.filter((column) => !input.presentColumns.includes(column))
  const bridgeUniqueIndexPresent = input.presentIndexes.includes(RECONCILIATION_BRIDGE_INDEX)
  const migrationReady = missingColumns.length === 0 && bridgeUniqueIndexPresent
  const blockers: string[] = []
  const warnings: string[] = []

  if (missingColumns.length) blockers.push(`Faltan columnas de conciliación: ${missingColumns.join(", ")}`)
  if (!bridgeUniqueIndexPresent) blockers.push(`Falta el índice único ${RECONCILIATION_BRIDGE_INDEX}`)
  if (input.integrity.orphanedCaptureLinks > 0) blockers.push(`Hay ${input.integrity.orphanedCaptureLinks} vínculos de captura sin factura operativa`)
  if (input.integrity.orphanedReceiptLinks > 0) blockers.push(`Hay ${input.integrity.orphanedReceiptLinks} albaranes con factura inexistente`)

  if (input.integrity.linkedStatusIssues > 0) warnings.push(`Hay ${input.integrity.linkedStatusIssues} capturas vinculadas con estado de conciliación inesperado`)
  if (input.duplicateKeys.length) warnings.push(`Hay ${input.duplicateKeys.length} claves NIF/número repetidas en capturas históricas`)

  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    status: blockers.length ? "BLOCKED" : warnings.length ? "WARNINGS" : "READY",
    schema: { migrationReady, missingColumns, bridgeUniqueIndexPresent },
    counts: input.counts,
    integrity: input.integrity,
    duplicateKeys: input.duplicateKeys,
    blockers,
    warnings,
  }
}
