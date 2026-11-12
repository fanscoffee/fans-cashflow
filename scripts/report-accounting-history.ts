import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { Prisma, PrismaClient } from "../src/generated/prisma/client"
import {
  buildHistoricalAccountingReport,
  type HistoricalAccountingCapture,
  type HistoricalOperationalInvoice,
  type HistoricalReceipt,
} from "../src/lib/accounting-historical-report"
import type { ReconciliationSupplier } from "../src/lib/accounting-reconciliation"

const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
])

type CliOptions = {
  json: boolean
  supplierId?: string
  offset?: number
  limit?: number
}

type LegacyCaptureRow = {
  id: string
  date: Date
  invoiceNumber: string
  supplierOrCreditor: string
  taxId: string
  concept: string
  exemptBase: unknown
  base21: unknown
  vat21: unknown
  base10: unknown
  vat10: unknown
  base4: unknown
  vat4: unknown
  base2: unknown
  vat2: unknown
  totalBase: unknown
  totalVat: unknown
  withholdingTax: unknown
  invoiceTotal: unknown
  paymentMethod: string
}

function parseNonNegativeInteger(value: string, name: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} debe ser un entero no negativo`)
  return parsed
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { json: true }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === "--") {
      continue
    } else if (argument === "--text") {
      options.json = false
    } else if (argument === "--json") {
      options.json = true
    } else if (argument === "--supplier-id") {
      options.supplierId = argv[++index]
      if (!options.supplierId) throw new Error("--supplier-id requiere un valor")
    } else if (argument === "--offset") {
      const value = argv[++index]
      if (value == null) throw new Error("--offset requiere un valor")
      options.offset = parseNonNegativeInteger(value, "--offset")
    } else if (argument === "--limit") {
      const value = argv[++index]
      if (value == null) throw new Error("--limit requiere un valor")
      options.limit = parseNonNegativeInteger(value, "--limit")
    } else if (argument === "--help" || argument === "-h") {
      console.log(`Uso: pnpm db:report-accounting-history [opciones]

Informe histórico de solo lectura. No crea, actualiza ni elimina registros.
Si la migración aún no existe, usa un modo legacy read-only sin vínculos ni tipos de documento.

Opciones:
  --json                 imprime el informe JSON (por defecto)
  --text                 imprime un resumen legible
  --supplier-id <id>     limita el detalle a un proveedor resuelto
  --offset <n>           salta capturas del detalle seleccionado
  --limit <n>            limita el lote del detalle seleccionado
  --help                 muestra esta ayuda`)
      process.exit(0)
    } else {
      throw new Error(`Opción no reconocida: ${argument}`)
    }
  }
  return options
}

function createReadOnlyPrisma() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL o DIRECT_URL es obligatorio")

  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }).$extends({
    name: "historical-report-read-only",
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          if (WRITE_OPERATIONS.has(operation)) throw new Error(`Operación de escritura bloqueada: ${operation}`)
          return query(args)
        },
      },
    },
  })

  return client as unknown as PrismaClient
}

function printTextReport(report: ReturnType<typeof buildHistoricalAccountingReport>) {
  const { counts } = report
  console.log("=== INFORME HISTÓRICO DE FACTURAS — SOLO LECTURA ===")
  console.log(`Generado: ${report.generatedAt}`)
  console.log(`Modo de datos: ${report.criteria.dataMode}`)
  console.log(`Capturas: ${counts.captureCount} | vinculadas: ${counts.linkedCaptureCount} | pendientes: ${counts.pendingCaptureCount}`)
  console.log(`Gastos: ${counts.expenseCaptureCount} | NO_APLICA efectivo: ${counts.expensesNotApplicableCount} | pendientes de marcar: ${counts.expensesNeedingStatusReviewCount}`)
  console.log(`Albaranes: ${counts.receiptCount} | libres: ${counts.unlinkedReceiptCount} | vinculados: ${counts.linkedReceiptCount}`)
  console.log(`Facturas operativas: ${counts.invoiceCount} | sin captura: ${counts.invoiceWithoutCaptureCount}`)
  console.log(`Agrupaciones candidatas: ${counts.groupedCandidateCount} en ${counts.groupedCandidateCaptureCount} capturas`)
  console.log(`Conflictos de candidatos A/B: ${counts.candidateConflictReceiptCount}`)
  console.log(`Detalle seleccionado: ${report.selection.selectedCaptureReports}/${report.selection.totalCaptureReports}`)
  console.log("")

  for (const capture of report.captures) {
    const best = capture.bestCandidate
    const grouped = capture.bestGroupedCandidate
    const candidate = best ? `${best.level} ${best.deliveryNoteCodes.join(", ")}` : "sin candidato"
    const groupedText = grouped ? ` | grupo: ${grouped.deliveryNoteCodes.join(", ")}` : ""
    console.log(`${capture.id} | ${capture.date.slice(0, 10)} | ${capture.invoiceNumber || "(sin número)"} | base ${capture.totalBase.toFixed(2)} | total ${capture.invoiceTotal.toFixed(2)} | ${capture.reviewState} | ${candidate}${groupedText}`)
    if (capture.statusNote) console.log(`  Nota: ${capture.statusNote}`)
  }

  if (report.pendingReceipts.length) {
    console.log("")
    console.log(`=== ALBARANES PENDIENTES (${report.pendingReceipts.length}) ===`)
    for (const receipt of report.pendingReceipts) {
      console.log(`${receipt.id} | ${receipt.receivedAt.slice(0, 10)} | ${receipt.deliveryNoteCode} | ${receipt.supplierName} | ${receipt.baseTotal.toFixed(2)}`)
    }
  }
}

async function loadCaptures(prisma: PrismaClient) {
  const columns = await prisma.$queryRaw<Array<{ columnName: string }>>(Prisma.sql`
    SELECT "column_name" AS "columnName"
    FROM "information_schema"."columns"
    WHERE "table_schema" = 'public'
      AND "table_name" = 'AccountingInvoice'
      AND "column_name" IN ('documentType', 'inventoryInvoiceId', 'linkedAt', 'linkedById', 'reconciliationStatus', 'supplierId')
  `)
  const bridgeReady = columns.length === 6
  if (bridgeReady) {
    const captures = await prisma.accountingInvoice.findMany({
      orderBy: [{ date: "asc" }, { id: "asc" }],
      include: {
        inventoryInvoice: {
          select: {
            id: true,
            supplierId: true,
            series: true,
            number: true,
            issueDate: true,
            totalAmount: true,
            workflowStatus: true,
            deliveryNotes: {
              select: { id: true, deliveryNoteCode: true, receivedAt: true },
            },
          },
        },
      },
    })
    return { captures: captures as unknown as HistoricalAccountingCapture[], dataMode: "BRIDGE" as const }
  }

  const legacyCaptures = await prisma.$queryRaw<LegacyCaptureRow[]>(Prisma.sql`
    SELECT
      "id", "date", "invoiceNumber", "supplierOrCreditor", "taxId", "concept",
      "exemptBase", "base21", "vat21", "base10", "vat10", "base4", "vat4",
      "base2", "vat2", "totalBase", "totalVat", "withholdingTax", "invoiceTotal", "paymentMethod"
    FROM "AccountingInvoice"
    ORDER BY "date" ASC, "id" ASC
  `)
  return {
    captures: legacyCaptures.map((capture) => ({
      ...capture,
      documentType: null,
      reconciliationStatus: "UNLINKED",
      supplierId: null,
      inventoryInvoiceId: null,
      linkedAt: null,
      linkedById: null,
      alerts: null,
    })),
    dataMode: "LEGACY_FALLBACK" as const,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const prisma = createReadOnlyPrisma()

  try {
    const [captureResult, suppliers, receipts, invoices] = await Promise.all([
      loadCaptures(prisma),
      prisma.supplier.findMany({
        orderBy: { legalName: "asc" },
        select: { id: true, legalName: true, taxId: true, billingAddress: true },
      }),
      prisma.receipt.findMany({
        orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          deliveryNoteCode: true,
          supplierId: true,
          invoiceId: true,
          receivedAt: true,
          transportCost: true,
          lines: {
            select: {
              productId: true,
              receivedQuantity: true,
              unitPrice: true,
              batch: true,
              dueDate: true,
              product: { select: { code: true, posDescription: true, purchaseUnit: true, purchaseVatPercentage: true } },
            },
          },
        },
      }),
      prisma.invoice.findMany({
        select: { id: true, supplierId: true, series: true, number: true, issueDate: true, totalAmount: true, workflowStatus: true },
      }),
    ])

    const report = buildHistoricalAccountingReport({
      captures: captureResult.captures,
      suppliers: suppliers as ReconciliationSupplier[],
      receipts: receipts as unknown as HistoricalReceipt[],
      invoices: invoices as unknown as HistoricalOperationalInvoice[],
    }, {
      supplierId: options.supplierId,
      offset: options.offset,
      limit: options.limit,
      dataMode: captureResult.dataMode,
    })

    if (options.json) console.log(JSON.stringify(report, null, 2))
    else printTextReport(report)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
