import { normalizeTaxId } from "@/lib/invoices"
import {
  AccountingReconciliationStatus,
  PaymentDocumentType,
} from "@/lib/database-enums"
import { toN } from "@/lib/money"
import {
  normalizeReconciliationText,
  rankSupplierCandidates,
  scoreReceiptSuggestion,
  splitAccountingInvoiceNumber,
  summarizeReceipt,
  type AccountingCaptureForReconciliation,
  type ReconciliationReceipt,
  type ReconciliationSupplier,
} from "@/lib/accounting-reconciliation"

export const HISTORICAL_AMOUNT_TOLERANCE = 0.02
export const HISTORICAL_DATE_WINDOW_DAYS = 31
export const HISTORICAL_CLOSE_DATE_WINDOW_DAYS = 7
export const HISTORICAL_WEAK_DATE_WINDOW_DAYS = 90
export const HISTORICAL_MAX_GROUP_SIZE = 6
export const HISTORICAL_MAX_GROUP_RESULTS = 10
export const HISTORICAL_MAX_SINGLE_RESULTS = 20

const MAX_GROUP_SEARCH_NODES = 100_000

export type HistoricalAccountingCapture = AccountingCaptureForReconciliation & {
  documentType?: string | null
  reconciliationStatus?: string | null
  supplierId?: string | null
  inventoryInvoiceId?: string | null
  linkedAt?: Date | null
  linkedById?: string | null
  inventoryInvoice?: HistoricalOperationalInvoice | null
}

export type HistoricalReceipt = ReconciliationReceipt & {
  invoiceId?: string | null
}

export type HistoricalOperationalInvoice = {
  id: string
  supplierId: string
  series: string
  number: string
  issueDate: Date
  totalAmount: unknown
  workflowStatus?: string | null
  deliveryNotes?: Array<{
    id: string
    deliveryNoteCode: string
    receivedAt: Date
  }>
}

export type HistoricalReportInput = {
  captures: HistoricalAccountingCapture[]
  suppliers: ReconciliationSupplier[]
  receipts: HistoricalReceipt[]
  invoices: HistoricalOperationalInvoice[]
}

export type HistoricalReportOptions = {
  supplierId?: string
  offset?: number
  limit?: number
  dataMode?: "BRIDGE" | "LEGACY_FALLBACK"
}

export type HistoricalMatchLevel = "A" | "B" | "C"

export type HistoricalSupplierCandidate = {
  id: string
  legalName: string
  taxId: string
  score: number
  reasons: string[]
}

export type HistoricalReceiptCandidate = {
  level: HistoricalMatchLevel
  score: number
  isGrouped: boolean
  receiptCount: number
  receiptIds: string[]
  deliveryNoteCodes: string[]
  supplierId: string
  supplierName: string
  reasons: string[]
  dateDistanceDays: number
  dateSpanDays: number
  receiptBase: number
  receiptTotalWithTransport: number
  amountDifference: number
  amountMatchesTransport: boolean
  referenceMatch: boolean
}

export type HistoricalLinkedInvoice = {
  id: string
  supplierId: string
  series: string
  number: string
  issueDate: string
  totalAmount: number
  workflowStatus: string | null
  deliveryNoteCodes: string[]
}

export type HistoricalCaptureReport = {
  id: string
  date: string
  invoiceNumber: string
  supplierOrCreditor: string
  taxId: string
  concept: string
  totalBase: number
  totalVat: number
  withholdingTax: number
  invoiceTotal: number
  documentType: string | null
  reconciliationStatus: string
  effectiveStatus: string
  linked: boolean
  linkedInvoiceId: string | null
  linkedReceiptIds: string[]
  linkedAt: string | null
  linkedById: string | null
  linkedInvoice: HistoricalLinkedInvoice | null
  selectedSupplierId: string | null
  supplierCandidates: HistoricalSupplierCandidate[]
  receiptCandidates: HistoricalReceiptCandidate[]
  groupedCandidates: HistoricalReceiptCandidate[]
  bestCandidate: HistoricalReceiptCandidate | null
  bestGroupedCandidate: HistoricalReceiptCandidate | null
  reviewState: "LINKED" | "NOT_APPLICABLE" | "PENDING" | "NO_MATCH"
  recommendedAction: "NONE" | "MARK_NOT_APPLICABLE" | "REVIEW_AND_LINK"
  statusNote: string | null
}

export type HistoricalProviderSummary = {
  supplierId: string | null
  supplierName: string
  captureCount: number
  linkedCaptureCount: number
  pendingCaptureCount: number
  captureWithCandidatesCount: number
  unlinkedReceiptCount: number
}

export type HistoricalReportCounts = {
  captureCount: number
  linkedCaptureCount: number
  unlinkedCaptureCount: number
  pendingCaptureCount: number
  captureWithCandidatesCount: number
  captureWithoutCandidatesCount: number
  expenseCaptureCount: number
  expensesNotApplicableCount: number
  expensesNeedingStatusReviewCount: number
  receiptCount: number
  linkedReceiptCount: number
  unlinkedReceiptCount: number
  invoiceCount: number
  invoiceWithoutCaptureCount: number
  groupedCandidateCaptureCount: number
  groupedCandidateCount: number
  candidateConflictReceiptCount: number
  rawStatusCounts: Record<string, number>
  effectiveStatusCounts: Record<string, number>
  documentTypeCounts: Record<string, number>
}

export type HistoricalCandidateConflict = {
  receiptId: string
  deliveryNoteCode: string
  captureIds: string[]
}

export type HistoricalAccountingReport = {
  generatedAt: string
  readOnly: true
  criteria: {
    amountTolerance: number
    dateWindowDays: number
    closeDateWindowDays: number
    weakDateWindowDays: number
    maxGroupSize: number
    dataMode: "BRIDGE" | "LEGACY_FALLBACK"
    supplierId: string | null
    offset: number
    limit: number | null
  }
  counts: HistoricalReportCounts
  selection: {
    totalCaptureReports: number
    selectedCaptureReports: number
    firstCaptureIndex: number
  }
  captures: HistoricalCaptureReport[]
  pendingReceipts: Array<{
    id: string
    deliveryNoteCode: string
    supplierId: string
    supplierName: string
    receivedAt: string
    baseTotal: number
    totalWithTransport: number
  }>
  providerSummaries: HistoricalProviderSummary[]
  candidateConflicts: HistoricalCandidateConflict[]
}

type SupplierEvidence = {
  supplier: ReconciliationSupplier
  score: number
  reasons: string[]
  exactTaxId: boolean
  nameMatch: boolean
  stored: boolean
}

type ScoredReceipt = {
  receipt: HistoricalReceipt
  summary: ReturnType<typeof summarizeReceipt>
  suggestion: ReturnType<typeof scoreReceiptSuggestion>
  evidence: SupplierEvidence | null
  dateDistanceDays: number
  referenceMatch: boolean
  amountDifference: number
  amountMatchesTransport: boolean
  amountMatch: boolean
}

function safeNumber(value: unknown) {
  const parsed = toN(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function dateDistanceDays(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) / 86_400_000
}

function dateSpanDays(dates: Date[]) {
  if (dates.length < 2) return 0
  const times = dates.map((date) => date.getTime())
  return (Math.max(...times) - Math.min(...times)) / 86_400_000
}

function iso(date: Date | null | undefined) {
  return date ? date.toISOString() : null
}

function increment(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] || 0) + 1
}

function isExpense(documentType: string | null | undefined) {
  return documentType === PaymentDocumentType.EXPENSE || documentType === "GASTO"
}

function isLinked(capture: HistoricalAccountingCapture) {
  return Boolean(capture.inventoryInvoiceId)
}

function supplierCandidateReasons(candidate: ReturnType<typeof rankSupplierCandidates>[number]) {
  return [...candidate.reasons]
}

function getSupplierEvidence(
  capture: HistoricalAccountingCapture,
  suppliers: ReconciliationSupplier[],
) {
  const ranked = rankSupplierCandidates(capture, suppliers)
  const rankedById = new Map(ranked.map((candidate) => [candidate.supplier.id, candidate]))
  const candidateIds = new Set<string>()

  for (const candidate of ranked.slice(0, 10)) candidateIds.add(candidate.supplier.id)
  if (capture.supplierId) candidateIds.add(capture.supplierId)

  const captureTaxId = normalizeTaxId(capture.taxId)
  const evidence = Array.from(candidateIds)
    .map((supplierId): SupplierEvidence | null => {
      const supplier = suppliers.find((item) => item.id === supplierId)
      if (!supplier) return null
      const rankedCandidate = rankedById.get(supplier.id)
      const reasons = rankedCandidate ? supplierCandidateReasons(rankedCandidate) : ["proveedor guardado en la captura"]
      const exactTaxId = Boolean(captureTaxId && captureTaxId === normalizeTaxId(supplier.taxId))
      const nameMatch = reasons.some((reason) => reason.startsWith("nombre"))
      const stored = capture.supplierId === supplier.id
      if (exactTaxId && !reasons.includes("NIF coincidente")) reasons.unshift("NIF coincidente")
      return {
        supplier,
        score: rankedCandidate?.score || (stored ? 10 : 0),
        reasons: Array.from(new Set(reasons)),
        exactTaxId,
        nameMatch,
        stored,
      }
    })
    .filter((item): item is SupplierEvidence => Boolean(item))
    .sort((left, right) => right.score - left.score || left.supplier.legalName.localeCompare(right.supplier.legalName))

  return { evidence }
}

function invoiceReferenceTokens(invoiceNumber: string) {
  const { series, number } = splitAccountingInvoiceNumber(invoiceNumber)
  return [invoiceNumber, number, series ? `${series}${number}` : ""]
    .map((value) => normalizeReconciliationText(value))
    .filter((value, index, values) => value.length >= 2 && values.indexOf(value) === index)
}

function hasReferenceMatch(capture: HistoricalAccountingCapture, receipt: HistoricalReceipt) {
  const deliveryNoteCode = normalizeReconciliationText(receipt.deliveryNoteCode)
  return invoiceReferenceTokens(capture.invoiceNumber).some((token) => deliveryNoteCode.includes(token))
}

function scoreReceipt(
  capture: HistoricalAccountingCapture,
  receipt: HistoricalReceipt,
  evidence: SupplierEvidence | null,
): ScoredReceipt {
  const summary = summarizeReceipt(receipt)
  const suggestion = scoreReceiptSuggestion(capture, receipt)
  const targetBase = safeNumber(capture.totalBase)
  const baseDifference = Math.abs(summary.baseTotal - targetBase)
  const transportDifference = Math.abs(summary.totalWithTransport - targetBase)
  const amountDifference = Math.min(baseDifference, transportDifference)
  return {
    receipt,
    summary,
    suggestion,
    evidence,
    dateDistanceDays: dateDistanceDays(capture.date, receipt.receivedAt),
    referenceMatch: hasReferenceMatch(capture, receipt),
    amountDifference,
    amountMatchesTransport: transportDifference < baseDifference,
    amountMatch: targetBase > 0 && amountDifference <= HISTORICAL_AMOUNT_TOLERANCE,
  }
}

function levelForMatch(match: {
  exactTaxId: boolean
  nameMatch: boolean
  stored: boolean
  dateDistanceDays: number
  amountMatch: boolean
  referenceMatch: boolean
}) : HistoricalMatchLevel | null {
  const dateCompatible = match.dateDistanceDays <= HISTORICAL_DATE_WINDOW_DAYS
  const dateClose = match.dateDistanceDays <= HISTORICAL_CLOSE_DATE_WINDOW_DAYS
  const supplierEvidence = match.exactTaxId || match.nameMatch || match.stored

  if (match.exactTaxId && dateCompatible && match.amountMatch && match.referenceMatch) return "A"
  if (match.exactTaxId && dateClose && match.amountMatch) return "B"
  if (supplierEvidence && (dateCompatible || match.amountMatch || match.referenceMatch)) return "C"
  if (!supplierEvidence && (match.amountMatch || match.referenceMatch) && dateCompatible) return "C"
  return null
}

function sortedCandidates(candidates: HistoricalReceiptCandidate[]) {
  const levelWeight: Record<HistoricalMatchLevel, number> = { A: 3, B: 2, C: 1 }
  return [...candidates].sort((left, right) =>
    levelWeight[right.level] - levelWeight[left.level]
    || right.score - left.score
    || left.amountDifference - right.amountDifference
    || left.dateDistanceDays - right.dateDistanceDays
    || left.receiptIds.join(",").localeCompare(right.receiptIds.join(",")),
  )
}

function buildSingleCandidate(match: ScoredReceipt, supplierById: Map<string, ReconciliationSupplier>): HistoricalReceiptCandidate | null {
  const evidence = match.evidence
  const level = levelForMatch({
    exactTaxId: evidence?.exactTaxId || false,
    nameMatch: evidence?.nameMatch || false,
    stored: evidence?.stored || false,
    dateDistanceDays: match.dateDistanceDays,
    amountMatch: match.amountMatch,
    referenceMatch: match.referenceMatch,
  })
  if (!level) return null

  const supplier = supplierById.get(match.receipt.supplierId)
  if (!supplier) return null

  const reasons = [
    ...(evidence?.reasons || []),
    ...match.suggestion.reasons,
  ]
  if (match.amountMatch) reasons.push("importe dentro de tolerancia")
  if (match.referenceMatch && !reasons.includes("referencia coincidente")) reasons.push("referencia coincidente")
  if (match.dateDistanceDays <= HISTORICAL_CLOSE_DATE_WINDOW_DAYS && !reasons.includes("fecha cercana")) reasons.push("fecha cercana")
  if (match.dateDistanceDays <= HISTORICAL_DATE_WINDOW_DAYS && !reasons.includes("fecha compatible")) reasons.push("fecha compatible")

  return {
    level,
    score: round(match.suggestion.score + (evidence?.score || 0)),
    isGrouped: false,
    receiptCount: 1,
    receiptIds: [match.receipt.id],
    deliveryNoteCodes: [match.receipt.deliveryNoteCode],
    supplierId: supplier.id,
    supplierName: supplier.legalName,
    reasons: Array.from(new Set(reasons)),
    dateDistanceDays: round(match.dateDistanceDays, 2),
    dateSpanDays: 0,
    receiptBase: match.summary.baseTotal,
    receiptTotalWithTransport: match.summary.totalWithTransport,
    amountDifference: round(match.amountDifference),
    amountMatchesTransport: match.amountMatchesTransport,
    referenceMatch: match.referenceMatch,
  }
}

type GroupSearchEntry = ScoredReceipt & { supplier: ReconciliationSupplier }

function searchReceiptGroups(
  capture: HistoricalAccountingCapture,
  scoredReceipts: ScoredReceipt[],
  supplierById: Map<string, ReconciliationSupplier>,
) {
  const target = safeNumber(capture.totalBase)
  if (target <= 0) return []

  const bySupplier = new Map<string, GroupSearchEntry[]>()
  for (const scored of scoredReceipts) {
    if (scored.dateDistanceDays > HISTORICAL_DATE_WINDOW_DAYS) continue
    const supplier = supplierById.get(scored.receipt.supplierId)
    if (!supplier) continue
    const entries = bySupplier.get(supplier.id) || []
    entries.push({ ...scored, supplier })
    bySupplier.set(supplier.id, entries)
  }

  const groups: HistoricalReceiptCandidate[] = []
  const targetCents = Math.round(target * 100)
  const toleranceCents = Math.round(HISTORICAL_AMOUNT_TOLERANCE * 100)

  for (const entries of bySupplier.values()) {
    entries.sort((left, right) =>
      left.dateDistanceDays - right.dateDistanceDays
      || left.receipt.id.localeCompare(right.receipt.id),
    )
    let nodes = 0
    const chosen: GroupSearchEntry[] = []
    const found = new Set<string>()

    const visit = (start: number, baseCents: number) => {
      if (nodes >= MAX_GROUP_SEARCH_NODES || groups.length >= HISTORICAL_MAX_GROUP_RESULTS) return
      nodes += 1

      if (chosen.length >= 2) {
        const totalCents = Math.round(chosen.reduce((sum, item) => sum + item.summary.totalWithTransport, 0) * 100)
        const baseDifference = Math.abs(baseCents - targetCents)
        const totalDifference = Math.abs(totalCents - targetCents)
        if (baseDifference <= toleranceCents || totalDifference <= toleranceCents) {
              const orderedChosen = [...chosen].sort((left, right) => left.receipt.id.localeCompare(right.receipt.id))
              const receiptIds = orderedChosen.map((item) => item.receipt.id)
          const key = receiptIds.join(",")
          if (!found.has(key)) {
            found.add(key)
            const referenceMatch = chosen.some((item) => item.referenceMatch)
            const dateDistance = Math.max(...chosen.map((item) => item.dateDistanceDays))
            const evidence = chosen[0].evidence
            const level = levelForMatch({
              exactTaxId: evidence?.exactTaxId || false,
              nameMatch: evidence?.nameMatch || false,
              stored: evidence?.stored || false,
              dateDistanceDays: dateDistance,
              amountMatch: true,
              referenceMatch,
            })
            if (level) {
              const receiptBase = round(chosen.reduce((sum, item) => sum + item.summary.baseTotal, 0))
              const receiptTotalWithTransport = round(chosen.reduce((sum, item) => sum + item.summary.totalWithTransport, 0))
              const amountMatchesTransport = Math.abs(receiptTotalWithTransport - target) < Math.abs(receiptBase - target)
              const reasons = [
                ...(evidence?.reasons || []),
                `agrupación de ${chosen.length} albaranes`,
                "importe agrupado dentro de tolerancia",
                ...(referenceMatch ? ["referencia coincidente"] : []),
                ...(dateDistance <= HISTORICAL_CLOSE_DATE_WINDOW_DAYS ? ["fechas cercanas"] : ["fechas compatibles"]),
              ]
              groups.push({
                level,
                score: round(chosen.reduce((sum, item) => sum + item.suggestion.score, 0) + (evidence?.score || 0) + 10),
                isGrouped: true,
                receiptCount: chosen.length,
                receiptIds,
                deliveryNoteCodes: orderedChosen.map((item) => item.receipt.deliveryNoteCode),
                supplierId: chosen[0].supplier.id,
                supplierName: chosen[0].supplier.legalName,
                reasons: Array.from(new Set(reasons)),
                dateDistanceDays: round(dateDistance, 2),
                dateSpanDays: round(dateSpanDays(chosen.map((item) => item.receipt.receivedAt)), 2),
                receiptBase,
                receiptTotalWithTransport,
                amountDifference: round(Math.min(baseDifference, totalDifference) / 100),
                amountMatchesTransport,
                referenceMatch,
              })
            }
          }
        }
      }

      if (chosen.length >= HISTORICAL_MAX_GROUP_SIZE) return
      for (let index = start; index < entries.length; index += 1) {
        const next = entries[index]
        const nextBaseCents = baseCents + Math.round(next.summary.baseTotal * 100)
        if (nextBaseCents > targetCents + toleranceCents) continue
        chosen.push(next)
        visit(index + 1, nextBaseCents)
        chosen.pop()
        if (nodes >= MAX_GROUP_SEARCH_NODES || groups.length >= HISTORICAL_MAX_GROUP_RESULTS) return
      }
    }

    visit(0, 0)
  }

  return sortedCandidates(groups).slice(0, HISTORICAL_MAX_GROUP_RESULTS)
}

function linkedInvoiceForReport(
  capture: HistoricalAccountingCapture,
  receipts: HistoricalReceipt[],
): HistoricalLinkedInvoice | null {
  const linkedInvoice = capture.inventoryInvoice
  if (!linkedInvoice && !capture.inventoryInvoiceId) return null

  const linkedReceiptCodes = new Set<string>()
  for (const receipt of receipts) {
    if (receipt.invoiceId === capture.inventoryInvoiceId) linkedReceiptCodes.add(receipt.deliveryNoteCode)
  }
  for (const receipt of linkedInvoice?.deliveryNotes || []) linkedReceiptCodes.add(receipt.deliveryNoteCode)

  return linkedInvoice
    ? {
        id: linkedInvoice.id,
        supplierId: linkedInvoice.supplierId,
        series: linkedInvoice.series,
        number: linkedInvoice.number,
        issueDate: linkedInvoice.issueDate.toISOString(),
        totalAmount: safeNumber(linkedInvoice.totalAmount),
        workflowStatus: linkedInvoice.workflowStatus || null,
        deliveryNoteCodes: Array.from(linkedReceiptCodes).sort(),
      }
    : null
}

function buildCaptureReport(
  capture: HistoricalAccountingCapture,
  suppliers: ReconciliationSupplier[],
  receipts: HistoricalReceipt[],
) {
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]))
  const { evidence } = getSupplierEvidence(capture, suppliers)
  const linked = isLinked(capture)
  const expense = isExpense(capture.documentType)
  const rawStatus = capture.reconciliationStatus || AccountingReconciliationStatus.UNLINKED
  const linkedReceiptIds = capture.inventoryInvoiceId
    ? receipts
        .filter((receipt) => receipt.invoiceId === capture.inventoryInvoiceId)
        .map((receipt) => receipt.id)
        .sort()
    : []
  for (const receipt of capture.inventoryInvoice?.deliveryNotes || []) {
    if (!linkedReceiptIds.includes(receipt.id)) linkedReceiptIds.push(receipt.id)
  }
  linkedReceiptIds.sort()

  const supplierCandidates = evidence.slice(0, 10).map((candidate) => ({
    id: candidate.supplier.id,
    legalName: candidate.supplier.legalName,
    taxId: candidate.supplier.taxId,
    score: candidate.score,
    reasons: [...candidate.reasons],
  }))
  const selectedSupplierId = evidence.find((candidate) => candidate.exactTaxId)?.supplier.id
    || (capture.supplierId && supplierById.has(capture.supplierId) ? capture.supplierId : null)
    || evidence[0]?.supplier.id
    || null
  const eligibleReceipts = receipts.filter((receipt) => !receipt.invoiceId)
  const evidenceBySupplierId = new Map(evidence.map((item) => [item.supplier.id, item]))
  const hasSupplierEvidence = evidence.length > 0
  const scoredReceipts = eligibleReceipts
    .filter((receipt) => {
      if (hasSupplierEvidence) return evidenceBySupplierId.has(receipt.supplierId)
      return true
    })
    .map((receipt) => scoreReceipt(capture, receipt, evidenceBySupplierId.get(receipt.supplierId) || null))
    .filter((match) => {
      const supplier = match.evidence
      const hasSupplierSignal = Boolean(supplier?.exactTaxId || supplier?.nameMatch || supplier?.stored)
      const hasStrongSignal = match.amountMatch || match.referenceMatch
      return match.dateDistanceDays <= HISTORICAL_WEAK_DATE_WINDOW_DAYS
        && (hasSupplierSignal
          || (hasStrongSignal && match.dateDistanceDays <= HISTORICAL_DATE_WINDOW_DAYS)
          || (!hasSupplierEvidence && match.dateDistanceDays <= HISTORICAL_DATE_WINDOW_DAYS))
    })

  const receiptCandidates = !linked && !expense
    ? sortedCandidates(scoredReceipts
        .map((match) => buildSingleCandidate(match, supplierById))
        .filter((candidate): candidate is HistoricalReceiptCandidate => Boolean(candidate)))
        .slice(0, HISTORICAL_MAX_SINGLE_RESULTS)
    : []
  const groupedCandidates = !linked && !expense
    ? searchReceiptGroups(capture, scoredReceipts, supplierById)
    : []

  let effectiveStatus = rawStatus
  let statusNote: string | null = null
  let reviewState: HistoricalCaptureReport["reviewState"]
  let recommendedAction: HistoricalCaptureReport["recommendedAction"]
  if (linked) {
    reviewState = "LINKED"
    recommendedAction = "NONE"
    if (expense) statusNote = "La captura está marcada como gasto pero tiene un vínculo operativo; revisar manualmente"
  } else if (expense) {
    effectiveStatus = AccountingReconciliationStatus.NOT_APPLICABLE
    reviewState = "NOT_APPLICABLE"
    recommendedAction = rawStatus === AccountingReconciliationStatus.NOT_APPLICABLE ? "NONE" : "MARK_NOT_APPLICABLE"
    if (recommendedAction === "MARK_NOT_APPLICABLE") statusNote = "El informe recomienda NO_APLICA; no se modifica la captura"
  } else if (receiptCandidates.length || groupedCandidates.length) {
    reviewState = "PENDING"
    recommendedAction = "REVIEW_AND_LINK"
  } else {
    reviewState = "NO_MATCH"
    recommendedAction = "REVIEW_AND_LINK"
    statusNote = "No se encontró candidato suficiente; requiere búsqueda manual"
  }

  const linkedInvoice = linkedInvoiceForReport(capture, receipts)
  return {
    id: capture.id,
    date: capture.date.toISOString(),
    invoiceNumber: capture.invoiceNumber,
    supplierOrCreditor: capture.supplierOrCreditor,
    taxId: capture.taxId,
    concept: capture.concept,
    totalBase: safeNumber(capture.totalBase),
    totalVat: safeNumber(capture.totalVat),
    withholdingTax: safeNumber(capture.withholdingTax),
    invoiceTotal: safeNumber(capture.invoiceTotal),
    documentType: capture.documentType || null,
    reconciliationStatus: rawStatus,
    effectiveStatus,
    linked,
    linkedInvoiceId: capture.inventoryInvoiceId || null,
    linkedReceiptIds,
    linkedAt: iso(capture.linkedAt),
    linkedById: capture.linkedById || null,
    selectedSupplierId,
    supplierCandidates,
    receiptCandidates,
    groupedCandidates,
    bestCandidate: receiptCandidates[0] || null,
    bestGroupedCandidate: groupedCandidates[0] || null,
    reviewState,
    recommendedAction,
    statusNote,
    linkedInvoice,
  }
}

function withoutPrivateFields(report: ReturnType<typeof buildCaptureReport>): HistoricalCaptureReport {
  return report
}

function buildPendingReceiptReports(
  receipts: HistoricalReceipt[],
  suppliers: ReconciliationSupplier[],
) {
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]))
  return receipts
    .filter((receipt) => !receipt.invoiceId)
    .map((receipt) => {
      const summary = summarizeReceipt(receipt)
      return {
        id: receipt.id,
        deliveryNoteCode: receipt.deliveryNoteCode,
        supplierId: receipt.supplierId,
        supplierName: supplierById.get(receipt.supplierId)?.legalName || "Proveedor no encontrado",
        receivedAt: receipt.receivedAt.toISOString(),
        baseTotal: summary.baseTotal,
        totalWithTransport: summary.totalWithTransport,
      }
    })
    .sort((left, right) => left.receivedAt.localeCompare(right.receivedAt) || left.id.localeCompare(right.id))
}

function buildProviderSummaries(
  captureReports: HistoricalCaptureReport[],
  receipts: HistoricalReceipt[],
  suppliers: ReconciliationSupplier[],
) {
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]))
  const summaries = new Map<string, HistoricalProviderSummary>()
  const getSummary = (supplierId: string | null) => {
    const key = supplierId || "__UNRESOLVED__"
    const existing = summaries.get(key)
    if (existing) return existing
    const created = {
      supplierId,
      supplierName: supplierId ? (supplierById.get(supplierId)?.legalName || "Proveedor no encontrado") : "Proveedor no resuelto",
      captureCount: 0,
      linkedCaptureCount: 0,
      pendingCaptureCount: 0,
      captureWithCandidatesCount: 0,
      unlinkedReceiptCount: 0,
    }
    summaries.set(key, created)
    return created
  }

  for (const capture of captureReports) {
    const summary = getSummary(capture.selectedSupplierId)
    summary.captureCount += 1
    if (capture.linked) summary.linkedCaptureCount += 1
    if (capture.reviewState === "PENDING" || capture.reviewState === "NO_MATCH") summary.pendingCaptureCount += 1
    if (capture.receiptCandidates.length || capture.groupedCandidates.length) summary.captureWithCandidatesCount += 1
  }

  for (const receipt of receipts) {
    if (receipt.invoiceId) continue
    getSummary(receipt.supplierId).unlinkedReceiptCount += 1
  }

  return Array.from(summaries.values()).sort((left, right) => left.supplierName.localeCompare(right.supplierName))
}

function buildCandidateConflicts(captureReports: HistoricalCaptureReport[]) {
  const byReceipt = new Map<string, { deliveryNoteCode: string; captureIds: Set<string> }>()
  for (const capture of captureReports) {
    const candidates = [
      ...capture.receiptCandidates.filter((candidate) => candidate.level !== "C").slice(0, 5),
      ...capture.groupedCandidates.filter((candidate) => candidate.level !== "C").slice(0, 5),
    ]
    for (const candidate of candidates) {
      candidate.receiptIds.forEach((receiptId, index) => {
        const existing = byReceipt.get(receiptId) || {
          deliveryNoteCode: candidate.deliveryNoteCodes[index] || receiptId,
          captureIds: new Set<string>(),
        }
        existing.captureIds.add(capture.id)
        byReceipt.set(receiptId, existing)
      })
    }
  }

  return Array.from(byReceipt.entries())
    .filter(([, value]) => value.captureIds.size > 1)
    .map(([receiptId, value]) => ({
      receiptId,
      deliveryNoteCode: value.deliveryNoteCode,
      captureIds: Array.from(value.captureIds).sort(),
    }))
    .sort((left, right) => left.receiptId.localeCompare(right.receiptId))
}

function buildCounts(
  captureReports: HistoricalCaptureReport[],
  receipts: HistoricalReceipt[],
  invoices: HistoricalOperationalInvoice[],
  candidateConflicts: HistoricalCandidateConflict[],
): HistoricalReportCounts {
  const rawStatusCounts: Record<string, number> = {}
  const effectiveStatusCounts: Record<string, number> = {}
  const documentTypeCounts: Record<string, number> = {}
  for (const capture of captureReports) {
    increment(rawStatusCounts, capture.reconciliationStatus)
    increment(effectiveStatusCounts, capture.effectiveStatus)
    increment(documentTypeCounts, capture.documentType || "UNSPECIFIED")
  }

  const expenseCaptureCount = captureReports.filter((capture) => isExpense(capture.documentType)).length
  const linkedCaptureCount = captureReports.filter((capture) => capture.linked).length
  const pendingCaptureCount = captureReports.filter((capture) => capture.reviewState === "PENDING" || capture.reviewState === "NO_MATCH").length
  const captureWithCandidatesCount = captureReports.filter((capture) => capture.receiptCandidates.length || capture.groupedCandidates.length).length
  const groupedCandidateCount = captureReports.reduce((sum, capture) => sum + capture.groupedCandidates.length, 0)

  return {
    captureCount: captureReports.length,
    linkedCaptureCount,
    unlinkedCaptureCount: captureReports.length - linkedCaptureCount,
    pendingCaptureCount,
    captureWithCandidatesCount,
    captureWithoutCandidatesCount: captureReports.filter((capture) => capture.reviewState === "NO_MATCH").length,
    expenseCaptureCount,
    expensesNotApplicableCount: captureReports.filter((capture) => capture.reviewState === "NOT_APPLICABLE").length,
    expensesNeedingStatusReviewCount: captureReports.filter((capture) => capture.recommendedAction === "MARK_NOT_APPLICABLE").length,
    receiptCount: receipts.length,
    linkedReceiptCount: receipts.filter((receipt) => Boolean(receipt.invoiceId)).length,
    unlinkedReceiptCount: receipts.filter((receipt) => !receipt.invoiceId).length,
    invoiceCount: invoices.length,
    invoiceWithoutCaptureCount: invoices.filter((invoice) => !captureReports.some((capture) => capture.linkedInvoiceId === invoice.id)).length,
    groupedCandidateCaptureCount: captureReports.filter((capture) => capture.groupedCandidates.length > 0).length,
    groupedCandidateCount,
    candidateConflictReceiptCount: candidateConflicts.length,
    rawStatusCounts,
    effectiveStatusCounts,
    documentTypeCounts,
  }
}

export function buildHistoricalAccountingReport(
  input: HistoricalReportInput,
  options: HistoricalReportOptions = {},
): HistoricalAccountingReport {
  const offset = Math.max(0, Math.trunc(options.offset || 0))
  const limit = options.limit == null ? null : Math.max(0, Math.trunc(options.limit))
  const allCaptureReports = input.captures
    .map((capture) => buildCaptureReport(capture, input.suppliers, input.receipts))
    .map(withoutPrivateFields)
  const candidateConflicts = buildCandidateConflicts(allCaptureReports)
  const counts = buildCounts(allCaptureReports, input.receipts, input.invoices, candidateConflicts)
  const filteredReports = options.supplierId
    ? allCaptureReports.filter((capture) => capture.selectedSupplierId === options.supplierId)
    : allCaptureReports
  const selectedReports = limit == null
    ? filteredReports.slice(offset)
    : filteredReports.slice(offset, offset + limit)

  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    criteria: {
      amountTolerance: HISTORICAL_AMOUNT_TOLERANCE,
      dateWindowDays: HISTORICAL_DATE_WINDOW_DAYS,
      closeDateWindowDays: HISTORICAL_CLOSE_DATE_WINDOW_DAYS,
      weakDateWindowDays: HISTORICAL_WEAK_DATE_WINDOW_DAYS,
      maxGroupSize: HISTORICAL_MAX_GROUP_SIZE,
      dataMode: options.dataMode || "BRIDGE",
      supplierId: options.supplierId || null,
      offset,
      limit,
    },
    counts,
    selection: {
      totalCaptureReports: filteredReports.length,
      selectedCaptureReports: selectedReports.length,
      firstCaptureIndex: offset,
    },
    captures: selectedReports,
    pendingReceipts: buildPendingReceiptReports(input.receipts, input.suppliers),
    providerSummaries: buildProviderSummaries(allCaptureReports, input.receipts, input.suppliers),
    candidateConflicts,
  }
}
