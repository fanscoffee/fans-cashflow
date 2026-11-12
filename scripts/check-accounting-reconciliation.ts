import "dotenv/config"
import { Client } from "pg"
import { normalizeAccountingInvoiceReference, normalizeAccountingTaxId } from "../src/lib/accounting-invoices"
import {
  buildReconciliationPreflightReport,
  REQUIRED_RECONCILIATION_COLUMNS,
  type ReconciliationPreflightInput,
} from "../src/lib/accounting-reconciliation-preflight"

type CliOptions = { json: boolean }

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { json: false }
  for (const argument of argv) {
    if (argument === "--" || argument === "--text") continue
    if (argument === "--json") {
      options.json = true
      continue
    }
    if (argument === "--help" || argument === "-h") {
      console.log(`Uso: pnpm db:check-accounting-reconciliation [--json|--text]

Comprueba el estado del puente de conciliación en una transacción READ ONLY.
No aplica migraciones ni modifica datos.`)
      process.exit(0)
    }
    throw new Error(`Opción no reconocida: ${argument}`)
  }
  return options
}

function asIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value
}

function duplicateKeys(rows: Array<{
  id: string
  taxId: string
  invoiceNumber: string
  date: Date | string
  supplierOrCreditor: string
  invoiceTotal: number | string
  createdAt: Date | string
}>) {
  const groups = new Map<string, {
    taxId: string
    invoiceNumber: string
    captureIds: string[]
    captures: Array<{ id: string; date: string; supplierOrCreditor: string; invoiceTotal: number | string; createdAt: string }>
  }>()
  for (const row of rows) {
    const taxId = normalizeAccountingTaxId(row.taxId || "")
    const invoiceNumber = normalizeAccountingInvoiceReference(row.invoiceNumber || "")
    if (!taxId || !invoiceNumber) continue
    const key = `${taxId}|${invoiceNumber}`
    const group = groups.get(key) || { taxId, invoiceNumber, captureIds: [], captures: [] }
    group.captureIds.push(row.id)
    group.captures.push({
      id: row.id,
      date: asIso(row.date),
      supplierOrCreditor: row.supplierOrCreditor,
      invoiceTotal: row.invoiceTotal,
      createdAt: asIso(row.createdAt),
    })
    groups.set(key, group)
  }
  return Array.from(groups.values())
    .filter((group) => group.captureIds.length > 1)
    .map((group) => ({ ...group, captures: group.captures.sort((left, right) => left.createdAt.localeCompare(right.createdAt)) }))
    .sort((left, right) => `${left.taxId}|${left.invoiceNumber}`.localeCompare(`${right.taxId}|${right.invoiceNumber}`))
}

function printText(report: ReturnType<typeof buildReconciliationPreflightReport>) {
  console.log(`=== PREFLIGHT CONCILIACIÓN: ${report.status} ===`)
  console.log(`Generado: ${report.generatedAt}`)
  console.log(`Migración preparada: ${report.schema.migrationReady ? "sí" : "no"}`)
  console.log(`Capturas: ${report.counts.accountingCaptures} | albaranes: ${report.counts.receipts} | facturas operativas: ${report.counts.invoices}`)
  console.log(`Vínculos: capturas ${report.counts.linkedCaptures} | albaranes ${report.counts.linkedReceipts}`)
  if (report.blockers.length) {
    console.log("Bloqueos:")
    for (const blocker of report.blockers) console.log(`- ${blocker}`)
  }
  if (report.warnings.length) {
    console.log("Avisos:")
    for (const warning of report.warnings) console.log(`- ${warning}`)
  }
  for (const duplicate of report.duplicateKeys) {
    console.log(`Duplicado ${duplicate.taxId}/${duplicate.invoiceNumber}:`)
    for (const capture of duplicate.captures) {
      console.log(`  ${capture.id} | ${capture.date.slice(0, 10)} | ${capture.supplierOrCreditor} | total ${capture.invoiceTotal}`)
    }
  }
  if (!report.blockers.length && !report.warnings.length) console.log("Sin bloqueos ni avisos.")
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL o DIRECT_URL es obligatorio")

  const client = new Client({ connectionString })
  let transactionStarted = false
  try {
    await client.connect()
    await client.query("BEGIN TRANSACTION READ ONLY")
    transactionStarted = true

    const columns = await client.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'AccountingInvoice'
         AND column_name = ANY($1::text[])
       ORDER BY column_name`,
      [REQUIRED_RECONCILIATION_COLUMNS],
    )
    const indexes = await client.query<{ indexname: string }>(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'AccountingInvoice'`,
    )
    const counts = await client.query<{
      receipts: number
      invoices: number
      accountingCaptures: number
      linkedReceipts: number
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM "Receipt") AS receipts,
         (SELECT COUNT(*)::int FROM "Invoice") AS invoices,
         (SELECT COUNT(*)::int FROM "AccountingInvoice") AS "accountingCaptures",
         (SELECT COUNT(*)::int FROM "Receipt" WHERE "invoiceId" IS NOT NULL) AS "linkedReceipts"`,
    )
    const countRow = counts.rows[0]
    if (!countRow) throw new Error("No se pudieron obtener los conteos base")

    const receiptIntegrity = await client.query<{ orphanedReceiptLinks: number }>(
      `SELECT COUNT(*)::int AS "orphanedReceiptLinks"
         FROM "Receipt" r
         LEFT JOIN "Invoice" i ON i."id" = r."invoiceId"
        WHERE r."invoiceId" IS NOT NULL AND i."id" IS NULL`,
    )
    const linked = columns.rows.length === REQUIRED_RECONCILIATION_COLUMNS.length
      ? await client.query<{ linkedCaptures: number; orphanedCaptureLinks: number; linkedStatusIssues: number }>(
          `SELECT
             (SELECT COUNT(*)::int FROM "AccountingInvoice" WHERE "inventoryInvoiceId" IS NOT NULL) AS "linkedCaptures",
             (SELECT COUNT(*)::int
                FROM "AccountingInvoice" a
                LEFT JOIN "Invoice" i ON i."id" = a."inventoryInvoiceId"
               WHERE a."inventoryInvoiceId" IS NOT NULL AND i."id" IS NULL) AS "orphanedCaptureLinks",
             (SELECT COUNT(*)::int
                FROM "AccountingInvoice"
               WHERE "inventoryInvoiceId" IS NOT NULL
                 AND "reconciliationStatus" NOT IN ('VINCULADA', 'CON_INCIDENCIA')) AS "linkedStatusIssues"`,
        )
      : { rows: [{ linkedCaptures: 0, orphanedCaptureLinks: 0, linkedStatusIssues: 0 }] }
    const linkedRow = linked.rows[0]
    if (!linkedRow) throw new Error("No se pudieron obtener los controles de integridad")
    const receiptIntegrityRow = receiptIntegrity.rows[0]
    if (!receiptIntegrityRow) throw new Error("No se pudieron obtener los controles de albaranes")

    const captureRows = await client.query<{
      id: string
      taxId: string
      invoiceNumber: string
      date: Date
      supplierOrCreditor: string
      invoiceTotal: string
      createdAt: Date
    }>(
      `SELECT "id", "taxId", "invoiceNumber", "date", "supplierOrCreditor", "invoiceTotal", "createdAt"
       FROM "AccountingInvoice"
       WHERE COALESCE("taxId", '') <> '' AND COALESCE("invoiceNumber", '') <> ''`,
    )

    const input: ReconciliationPreflightInput = {
      presentColumns: columns.rows.map((row) => row.column_name),
      presentIndexes: indexes.rows.map((row) => row.indexname),
      counts: {
        receipts: countRow.receipts,
        invoices: countRow.invoices,
        accountingCaptures: countRow.accountingCaptures,
        linkedCaptures: linkedRow.linkedCaptures,
        linkedReceipts: countRow.linkedReceipts,
      },
      integrity: {
        orphanedCaptureLinks: linkedRow.orphanedCaptureLinks,
        orphanedReceiptLinks: receiptIntegrityRow.orphanedReceiptLinks,
        linkedStatusIssues: linkedRow.linkedStatusIssues,
      },
      duplicateKeys: duplicateKeys(captureRows.rows),
    }
    const report = buildReconciliationPreflightReport(input)
    if (options.json) console.log(JSON.stringify(report, null, 2))
    else printText(report)
  } finally {
    if (transactionStarted) await client.query("ROLLBACK")
    await client.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
