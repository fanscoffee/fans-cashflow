import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { buildInvoiceAlerts, invoiceSchema, normalizeTaxId, type InvoiceInput } from "@/lib/invoices"
import { toN } from "@/lib/money"
import { InvoiceWorkflowStatus, PaymentDocumentType, paymentEntitySchema, type DatabasePaymentEntity } from "@/lib/database-enums"

export const reconciliationLinkSchema = z.object({
  receiptIds: z.array(z.string().trim().min(1)).min(1, "Selecciona al menos un albarán").max(500),
  supplierId: z.string().trim().min(1).optional(),
  entity: z.string().default("BAKERY").transform((value, context) => {
    const parsed = paymentEntitySchema.safeParse(value)
    if (!parsed.success) {
      context.addIssue({ code: "custom", message: "Entidad no válida" })
      return z.NEVER
    }
    return parsed.data
  }),
  includeTransport: z.boolean().default(true),
  providerExceptionReason: z.string().trim().max(500).optional(),
})

export const unlinkSchema = z.object({
  reason: z.string().trim().min(1, "Indica el motivo de la desvinculación").max(500),
})

export type ReconciliationLinkInput = z.infer<typeof reconciliationLinkSchema>

export type AccountingCaptureForReconciliation = {
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
  entity?: DatabasePaymentEntity | null
  documentType?: string | null
  reconciliationStatus?: string | null
  supplierId?: string | null
  inventoryInvoiceId?: string | null
  linkedAt?: Date | null
  linkedById?: string | null
  alerts?: unknown
}

export type ReconciliationSupplier = {
  id: string
  legalName: string
  taxId: string
  billingAddress: string | null
}

export type ReconciliationReceiptLine = {
  productId: string
  receivedQuantity: unknown
  unitPrice: unknown
  batch: string | null
  dueDate: Date | null
  product: {
    code: string
    posDescription: string
    purchaseUnit: string | null
    purchaseVatPercentage?: unknown
  }
}

export type ReconciliationReceipt = {
  id: string
  deliveryNoteCode: string
  supplierId: string
  receivedAt: Date
  transportCost: unknown
  lines: ReconciliationReceiptLine[]
}

export class ReconciliationError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "RECONCILIATION_VALIDATION",
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = "ReconciliationError"
  }
}

export function reconciliationErrorResponse(error: unknown) {
  if (error instanceof ReconciliationError) {
    return { error: error.message, code: error.code, ...(error.details === undefined ? {} : { details: error.details }), status: error.status }
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { error: "La factura ya está vinculada a otra captura o existe un duplicado", code: "RECONCILIATION_CONFLICT", status: 409 }
  }
  return { error: error instanceof Error ? error.message : "Error de conciliación", status: 500 }
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function normalizeReconciliationText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
}

function captureAlerts(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

export function splitAccountingInvoiceNumber(value: string) {
  const normalized = value.trim().toUpperCase()
  const separator = normalized.lastIndexOf("/")
  if (separator > 0 && separator < normalized.length - 1) {
    return { series: normalized.slice(0, separator).trim(), number: normalized.slice(separator + 1).trim() }
  }
  return { series: "", number: normalized }
}

export function rankSupplierCandidates(capture: Pick<AccountingCaptureForReconciliation, "taxId" | "supplierOrCreditor">, suppliers: ReconciliationSupplier[]) {
  const taxId = normalizeTaxId(capture.taxId)
  const name = normalizeReconciliationText(capture.supplierOrCreditor)

  return suppliers
    .map((supplier) => {
      const supplierTaxId = normalizeTaxId(supplier.taxId)
       const supplierName = normalizeReconciliationText(supplier.legalName)
      const reasons: string[] = []
      let score = 0
      if (taxId && taxId === supplierTaxId) {
        score += 100
        reasons.push("NIF coincidente")
      }
      if (name && supplierName === name) {
        score += 60
        reasons.push("nombre coincidente")
      } else if (name && (supplierName.includes(name) || name.includes(supplierName))) {
        score += 25
        reasons.push("nombre parecido")
      }
      return { supplier, score, reasons }
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.supplier.legalName.localeCompare(right.supplier.legalName))
}

export function resolveSupplierForLink(
  capture: Pick<AccountingCaptureForReconciliation, "taxId" | "supplierOrCreditor" | "supplierId">,
  suppliers: ReconciliationSupplier[],
  requestedSupplierId: string | undefined,
  providerExceptionReason: string | undefined,
) {
  const ranked = rankSupplierCandidates(capture, suppliers)
  const exact = ranked.filter((candidate) => candidate.reasons.includes("NIF coincidente"))
  const supplierId = requestedSupplierId || capture.supplierId || exact[0]?.supplier.id
  const supplier = supplierId ? suppliers.find((candidate) => candidate.id === supplierId) : undefined

  if (!supplier) {
    throw new ReconciliationError(
      "No se pudo resolver un proveedor del catálogo para esta captura",
      409,
      "SUPPLIER_NOT_RESOLVED",
      { candidates: ranked.map((candidate) => ({ ...candidate.supplier, score: candidate.score, reasons: candidate.reasons })) },
    )
  }

  const captureTaxId = normalizeTaxId(capture.taxId)
  const supplierTaxId = normalizeTaxId(supplier.taxId)
  const taxIdMismatch = Boolean(captureTaxId && captureTaxId !== supplierTaxId)
  const missingTaxId = !captureTaxId
  if ((taxIdMismatch || missingTaxId) && !providerExceptionReason) {
    throw new ReconciliationError(
      taxIdMismatch ? "El NIF de la captura no coincide con el proveedor" : "La captura no tiene NIF; confirma el proveedor con un motivo",
      409,
      "SUPPLIER_TAX_ID_MISMATCH",
      { captureTaxId: captureTaxId || null, supplierTaxId },
    )
  }

  return { supplier, ranked, taxIdMismatch: taxIdMismatch || missingTaxId }
}

function vatBuckets(capture: AccountingCaptureForReconciliation) {
  return [
    { percentage: 21, base: toN(capture.base21), tax: toN(capture.vat21) },
    { percentage: 10, base: toN(capture.base10), tax: toN(capture.vat10) },
    { percentage: 4, base: toN(capture.base4), tax: toN(capture.vat4) },
    { percentage: 2, base: toN(capture.base2), tax: toN(capture.vat2) },
    { percentage: 0, base: toN(capture.exemptBase), tax: 0 },
  ].filter((bucket) => bucket.base > 0 || bucket.tax > 0)
}

export function buildInvoiceTaxes(capture: AccountingCaptureForReconciliation) {
  const taxes: Array<{ type: string; percentage: number | null; taxableBase: number; taxAmount: number }> = vatBuckets(capture).map((bucket) => ({
    type: "IVA",
    percentage: bucket.percentage,
    taxableBase: round(bucket.base),
    taxAmount: round(bucket.tax),
  }))
  const withholding = round(toN(capture.withholdingTax))
  if (withholding > 0) taxes.push({ type: "IRPF", percentage: null, taxableBase: 0, taxAmount: withholding })
  return taxes
}

function singleVatRate(capture: AccountingCaptureForReconciliation) {
  const buckets = vatBuckets(capture).filter((bucket) => bucket.percentage > 0 && bucket.base > 0)
  return buckets.length === 1 ? buckets[0].percentage : null
}

export type OperationalInvoiceLineData = {
  productId: string | null
  lineType: string
  supplierReference: string | null
  itemCode: string | null
  description: string
  unitOfMeasure: string | null
  originalFormat: string | null
  quantity: number
  discountPercentage: number | null
  discountAmount: number
  unitPrice: number
  netUnitPrice: number
  taxableBase: number
  vatRate: number | null
  vatAmount: number
  lineTotal: number
  batch: string | null
  dueDate: Date | null
  validationAlert: string | null
}

export function buildOperationalInvoiceLines(
  receipts: ReconciliationReceipt[],
  capture: AccountingCaptureForReconciliation,
  includeTransport = true,
) {
  type ProductAccumulator = {
    productId: string
    description: string
    code: string
    unitOfMeasure: string | null
    quantity: number
    taxableBase: number
    batches: Set<string>
    dueDates: Set<number>
    purchaseVatPercentage: number | null
  }

  const products = new Map<string, ProductAccumulator>()
  for (const receipt of receipts) {
    for (const line of receipt.lines) {
      const quantity = toN(line.receivedQuantity)
      const base = quantity * toN(line.unitPrice)
      const current = products.get(line.productId) || {
        productId: line.productId,
        description: line.product.posDescription || line.product.code,
        code: line.product.code,
        unitOfMeasure: line.product.purchaseUnit,
        quantity: 0,
        taxableBase: 0,
        batches: new Set<string>(),
        dueDates: new Set<number>(),
        purchaseVatPercentage: line.product.purchaseVatPercentage == null
          ? null
          : Number.isFinite(toN(line.product.purchaseVatPercentage))
            ? toN(line.product.purchaseVatPercentage)
            : null,
      }
      current.quantity += quantity
      current.taxableBase += base
      if (line.batch) current.batches.add(line.batch)
      if (line.dueDate) current.dueDates.add(line.dueDate.getTime())
      products.set(line.productId, current)
    }
  }

  const fallbackVatRate = singleVatRate(capture)
  const lines: OperationalInvoiceLineData[] = Array.from(products.values()).map((product) => {
    const taxableBase = round(product.taxableBase)
    const quantity = round(product.quantity, 4)
    const unitPrice = quantity > 0 ? round(taxableBase / quantity, 4) : 0
    const vatRate = product.purchaseVatPercentage ?? fallbackVatRate
    const vatAmount = vatRate == null ? 0 : round(taxableBase * vatRate / 100)
    return {
      productId: product.productId,
      lineType: "PRODUCTO",
      supplierReference: null,
      itemCode: product.code,
      description: product.description,
      unitOfMeasure: product.unitOfMeasure,
      originalFormat: null,
      quantity,
      discountPercentage: null,
      discountAmount: 0,
      unitPrice,
      netUnitPrice: unitPrice,
      taxableBase,
      vatRate,
      vatAmount,
      lineTotal: round(taxableBase + vatAmount),
      batch: product.batches.size === 1 ? Array.from(product.batches)[0] : null,
      dueDate: product.dueDates.size === 1 ? new Date(Array.from(product.dueDates)[0]) : null,
      validationAlert: null,
    }
  })

  if (includeTransport) {
    for (const receipt of receipts) {
      const transportCost = round(toN(receipt.transportCost))
      if (transportCost <= 0) continue
      lines.push({
        productId: null,
        lineType: "CARGO",
        supplierReference: null,
        itemCode: null,
        description: `Transporte albarán ${receipt.deliveryNoteCode}`,
        unitOfMeasure: "ud",
        originalFormat: null,
        quantity: 1,
        discountPercentage: null,
        discountAmount: 0,
        unitPrice: transportCost,
        netUnitPrice: transportCost,
        taxableBase: transportCost,
        vatRate: null,
        vatAmount: 0,
        lineTotal: transportCost,
        batch: null,
        dueDate: null,
        validationAlert: null,
      })
    }
  }

  return lines
}

function receivedLinesForValidation(receipts: ReconciliationReceipt[]) {
  return receipts.flatMap((receipt) => receipt.lines.map((line) => ({
    productId: line.productId,
    receivedQuantity: line.receivedQuantity,
    unitPrice: line.unitPrice,
    product: { code: line.product.code, posDescription: line.product.posDescription },
  })))
}

export type OperationalInvoiceDraft = {
  series: string
  number: string
  issueDate: Date
  operationDate: Date | null
  deliveryNoteReference: string
  deliveryNoteDate: Date | null
  paymentMethod: string | null
  issuerLegalName: string
  issuerTaxId: string
  issuerBillingAddress: string
  netTotal: number
  totalVat: number
  withholdingTotal: number
  totalAmount: number
  lines: OperationalInvoiceLineData[]
  taxes: ReturnType<typeof buildInvoiceTaxes>
  alerts: string[]
  workflowStatus: typeof InvoiceWorkflowStatus.DRAFT | typeof InvoiceWorkflowStatus.ISSUE
  validationInput: InvoiceInput
}

export function buildOperationalInvoiceDraft(input: {
  capture: AccountingCaptureForReconciliation
  supplier: ReconciliationSupplier
  receipts: ReconciliationReceipt[]
  entity: DatabasePaymentEntity
  includeTransport: boolean
  providerExceptionReason?: string
}) : OperationalInvoiceDraft {
  if (input.capture.documentType === PaymentDocumentType.EXPENSE) {
    throw new ReconciliationError("Una captura marcada como gasto no puede vincularse a albaranes", 409, "DOCUMENT_NOT_APPLICABLE")
  }

  const { series, number } = splitAccountingInvoiceNumber(input.capture.invoiceNumber)
  if (!number) throw new ReconciliationError("La captura no tiene número de factura", 400, "MISSING_INVOICE_NUMBER")

  const lines = buildOperationalInvoiceLines(input.receipts, input.capture, input.includeTransport)
  if (!lines.some((line) => line.lineType === "PRODUCTO")) {
    throw new ReconciliationError("Los albaranes seleccionados no tienen líneas de producto", 409, "EMPTY_RECEIPTS")
  }

  const operationDate = input.receipts.length ? new Date(Math.min(...input.receipts.map((receipt) => receipt.receivedAt.getTime()))) : null
  const deliveryNoteDate = operationDate
  const billingAddress = input.supplier.billingAddress?.trim() || "No informado"
  const validationInput = invoiceSchema.parse({
    supplierId: input.supplier.id,
    entity: input.entity,
    documentType: PaymentDocumentType.MERCHANDISE_PURCHASE,
    recipientTaxId: "B09711078",
    series,
    number,
    issueDate: input.capture.date.toISOString(),
    operationDate: operationDate?.toISOString() || null,
    deliveryNoteReference: input.receipts.map((receipt) => receipt.deliveryNoteCode).join(", "),
    deliveryNoteDate: deliveryNoteDate?.toISOString() || null,
    paymentMethod: input.capture.paymentMethod,
    issuerLegalName: input.supplier.legalName,
    issuerTaxId: input.supplier.taxId,
    issuerBillingAddress: billingAddress,
    netTotal: toN(input.capture.totalBase),
    discountTotal: 0,
    totalVat: toN(input.capture.totalVat),
    surchargeTotal: 0,
    withholdingTotal: toN(input.capture.withholdingTax),
    totalAmount: toN(input.capture.invoiceTotal),
    receiptIds: input.receipts.map((receipt) => receipt.id),
    lines: lines.map((line) => ({
      ...line,
      supplierReference: line.supplierReference || "",
      itemCode: line.itemCode || "",
      unitOfMeasure: line.unitOfMeasure || "",
      originalFormat: line.originalFormat || "",
      batch: line.batch || "",
      dueDate: line.dueDate?.toISOString() || null,
    })),
    taxes: buildInvoiceTaxes(input.capture),
  })

  const validation = buildInvoiceAlerts(validationInput, receivedLinesForValidation(input.receipts))
  const alerts = [...captureAlerts(input.capture.alerts), ...validation.alerts]
  if (!input.supplier.billingAddress?.trim()) alerts.push("El proveedor no tiene domicilio de facturación; completa el dato antes de conformar")
  if (input.providerExceptionReason) alerts.push(`Excepción de proveedor confirmada: ${input.providerExceptionReason}`)

  const linesBase = round(lines.reduce((total, line) => total + line.taxableBase, 0))
  const capturedBase = round(toN(input.capture.totalBase))
  if (Math.abs(linesBase - capturedBase) > 0.02) {
    alerts.push(`Diferencia de base: albaranes ${linesBase.toFixed(2)} vs factura de gestoría ${capturedBase.toFixed(2)}`)
  }
  const expectedFromSelectedReceipts = round(linesBase + toN(input.capture.totalVat) - toN(input.capture.withholdingTax))
  const capturedTotal = round(toN(input.capture.invoiceTotal))
  if (Math.abs(expectedFromSelectedReceipts - capturedTotal) > 0.02) {
    alerts.push(`Diferencia de total: albaranes e impuestos ${expectedFromSelectedReceipts.toFixed(2)} vs factura de gestoría ${capturedTotal.toFixed(2)}`)
  }

  return {
    series,
    number,
    issueDate: input.capture.date,
    operationDate,
    deliveryNoteReference: validationInput.deliveryNoteReference,
    deliveryNoteDate,
    paymentMethod: input.capture.paymentMethod || null,
    issuerLegalName: input.supplier.legalName,
    issuerTaxId: input.supplier.taxId,
    issuerBillingAddress: billingAddress,
    netTotal: toN(input.capture.totalBase),
    totalVat: toN(input.capture.totalVat),
    withholdingTotal: toN(input.capture.withholdingTax),
    totalAmount: toN(input.capture.invoiceTotal),
    lines: lines.map((line, index) => ({ ...line, validationAlert: validation.lineAlerts.get(index) || null })),
    taxes: buildInvoiceTaxes(input.capture),
    alerts: Array.from(new Set(alerts)),
    workflowStatus: alerts.length ? InvoiceWorkflowStatus.ISSUE : InvoiceWorkflowStatus.DRAFT,
    validationInput,
  }
}

export function summarizeReceipt(receipt: ReconciliationReceipt) {
  const baseTotal = round(receipt.lines.reduce((total, line) => total + toN(line.receivedQuantity) * toN(line.unitPrice), 0))
  const transportCost = round(toN(receipt.transportCost))
  return {
    id: receipt.id,
    deliveryNoteCode: receipt.deliveryNoteCode,
    receivedAt: receipt.receivedAt.toISOString(),
    lineCount: receipt.lines.length,
    productIds: Array.from(new Set(receipt.lines.map((line) => line.productId))),
    baseTotal,
    transportCost,
    totalWithTransport: round(baseTotal + transportCost),
  }
}

export function scoreReceiptSuggestion(capture: AccountingCaptureForReconciliation, receipt: ReconciliationReceipt) {
  const summary = summarizeReceipt(receipt)
  const reasons: string[] = []
  let score = 0
  const days = Math.abs(receipt.receivedAt.getTime() - capture.date.getTime()) / 86_400_000
  if (days <= 1) {
    score += 30
    reasons.push("fecha coincidente")
  } else if (days <= 7) {
    score += 20
    reasons.push("fecha cercana")
  } else if (days <= 31) {
    score += 10
    reasons.push("fecha compatible")
  }
  const capturedBase = toN(capture.totalBase)
  if (capturedBase > 0 && Math.abs(summary.baseTotal - capturedBase) <= 0.02) {
    score += 50
    reasons.push("base coincidente")
  } else if (capturedBase > 0 && Math.abs(summary.totalWithTransport - capturedBase) <= 0.02) {
    score += 40
    reasons.push("base coincidente con transporte")
  }
  const invoiceNumber = normalizeReconciliationText(capture.invoiceNumber)
  if (invoiceNumber && normalizeReconciliationText(receipt.deliveryNoteCode).includes(invoiceNumber)) {
    score += 20
    reasons.push("referencia coincidente")
  }
  return { ...summary, score, reasons }
}

export function lockAccountingInvoice(tx: Prisma.TransactionClient, id: string) {
  return tx.$queryRaw(Prisma.sql`SELECT "id" FROM "AccountingInvoice" WHERE "id" = ${id} FOR UPDATE`)
}

export function lockInvoice(tx: Prisma.TransactionClient, id: string) {
  return tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${id} FOR UPDATE`)
}

export function lockReceiptsForInvoice(tx: Prisma.TransactionClient, invoiceId: string) {
  return tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "Receipt"
    WHERE "invoiceId" = ${invoiceId}
    ORDER BY "id"
    FOR UPDATE
  `)
}

export function lockReceipts(tx: Prisma.TransactionClient, ids: string[]) {
  if (!ids.length) return Promise.resolve([])
  return tx.$queryRaw<Array<{ id: string; invoiceId: string | null; supplierId: string }>>(Prisma.sql`
    SELECT "id", "invoiceId", "supplierId"
    FROM "Receipt"
    WHERE "id" IN (${Prisma.join(ids)})
    ORDER BY "id"
    FOR UPDATE
  `)
}
