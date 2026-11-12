import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { canAccessAccounting } from "@/lib/accounting-invoices"
import {
  rankSupplierCandidates,
  scoreReceiptSuggestion,
  summarizeReceipt,
  type AccountingCaptureForReconciliation,
  type ReconciliationReceipt,
  type ReconciliationSupplier,
} from "@/lib/accounting-reconciliation"
import { AccountingReconciliationStatus } from "@/lib/database-enums"

const accountingDecimalFields = [
  "exemptBase", "base21", "vat21", "base10", "vat10", "base4", "vat4", "base2", "vat2",
  "totalBase", "totalVat", "withholdingTax", "invoiceTotal",
] as const

function serializeCapture(capture: Record<string, unknown>) {
  const result: Record<string, unknown> = { ...capture }
  if (capture.date instanceof Date) result.date = capture.date.toISOString()
  for (const field of accountingDecimalFields) {
    const value = capture[field]
    result[field] = value == null ? 0 : Number(value)
  }
  delete result.supplier
  delete result.inventoryInvoice
  return result
}

function serializeReceipt(receipt: ReceiptWithCapture) {
  return {
    ...scoreReceiptSuggestion(receipt.capture, receipt),
    lines: receipt.lines.map((line) => ({
      productId: line.productId,
      receivedQuantity: Number(line.receivedQuantity),
      unitPrice: Number(line.unitPrice),
      batch: line.batch,
      dueDate: line.dueDate?.toISOString() || null,
      product: line.product,
    })),
  }
}

type ReceiptWithCapture = ReconciliationReceipt & { capture: AccountingCaptureForReconciliation }

export const GET = withAuth(async (_request, session, context) => {
  if (!canAccessAccounting(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await context.params

  try {
    const capture = await prisma.accountingInvoice.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, legalName: true, taxId: true, billingAddress: true } },
        inventoryInvoice: {
          select: {
            id: true,
            series: true,
            number: true,
            workflowStatus: true,
            totalAmount: true,
            deliveryNotes: { select: { id: true, deliveryNoteCode: true, receivedAt: true } },
          },
        },
      },
    })
    if (!capture) return NextResponse.json({ error: "Factura de gestoría no encontrada" }, { status: 404 })

    const captureForMatching = capture as unknown as AccountingCaptureForReconciliation
    const suppliers = await prisma.supplier.findMany({
      select: { id: true, legalName: true, taxId: true, billingAddress: true },
    }) as ReconciliationSupplier[]
    const ranked = rankSupplierCandidates(captureForMatching, suppliers)
    const storedSupplier = capture.supplierId ? suppliers.find((supplier) => supplier.id === capture.supplierId) : undefined
    const exactSupplier = ranked.find((candidate) => candidate.reasons.includes("NIF coincidente"))?.supplier
    const supplier = exactSupplier || storedSupplier || null

    const receipts = !capture.inventoryInvoiceId && capture.documentType !== "EXPENSE" && supplier
      ? await prisma.receipt.findMany({
          where: { supplierId: supplier.id, invoiceId: null },
          orderBy: { receivedAt: "desc" },
          take: 100,
          include: {
            lines: {
              include: {
                product: { select: { code: true, posDescription: true, purchaseUnit: true, purchaseVatPercentage: true } },
              },
            },
          },
        }) as unknown as ReconciliationReceipt[]
      : []

    const captureWithReceipts = receipts.map((receipt) => ({ ...receipt, capture: captureForMatching })) as ReceiptWithCapture[]
    const suggestions = captureWithReceipts.map((receipt) => serializeReceipt(receipt)).sort((left, right) => right.score - left.score)
    const alerts: string[] = []
    if (!exactSupplier && !storedSupplier) alerts.push("No se encontró un proveedor del catálogo con el NIF de la captura")
    if (supplier && receipts.length === 0) alerts.push("No hay albaranes libres para este proveedor")
    if (capture.documentType === "EXPENSE") alerts.push("La captura está marcada como gasto y no debe vincularse a albaranes")

    let status = capture.reconciliationStatus || AccountingReconciliationStatus.UNLINKED
    if (!capture.inventoryInvoiceId && capture.documentType === "EXPENSE" && status !== AccountingReconciliationStatus.NOT_APPLICABLE) {
      await prisma.accountingInvoice.updateMany({
        where: { id, inventoryInvoiceId: null },
        data: { reconciliationStatus: AccountingReconciliationStatus.NOT_APPLICABLE },
      })
      status = AccountingReconciliationStatus.NOT_APPLICABLE
    } else if (!capture.inventoryInvoiceId && exactSupplier && receipts.length > 0 && status === AccountingReconciliationStatus.UNLINKED) {
      await prisma.accountingInvoice.updateMany({
        where: { id, reconciliationStatus: AccountingReconciliationStatus.UNLINKED },
        data: { supplierId: exactSupplier.id, reconciliationStatus: AccountingReconciliationStatus.SUGGESTED },
      })
      status = AccountingReconciliationStatus.SUGGESTED
    }

    const linkedInvoice = capture.inventoryInvoice
      ? {
          ...capture.inventoryInvoice,
          totalAmount: Number(capture.inventoryInvoice.totalAmount),
          deliveryNotes: capture.inventoryInvoice.deliveryNotes.map((deliveryNote) => ({
            ...deliveryNote,
            receivedAt: deliveryNote.receivedAt.toISOString(),
          })),
        }
      : null

    return NextResponse.json({
      capture: serializeCapture(capture as unknown as Record<string, unknown>),
      status,
      supplier,
      supplierCandidates: ranked.map((candidate) => ({ ...candidate.supplier, score: candidate.score, reasons: candidate.reasons })),
      linkedInvoice,
      deliveryNotes: receipts.map((receipt) => serializeReceipt({ ...receipt, capture: captureForMatching } as ReceiptWithCapture)),
      suggestedReceiptIds: suggestions.filter((suggestion) => suggestion.score >= 40).map((suggestion) => suggestion.id),
      totals: {
        invoiceBase: Number(capture.totalBase),
        invoiceVat: Number(capture.totalVat),
        invoiceTotal: Number(capture.invoiceTotal),
        availableReceiptBase: receipts.reduce((sum, receipt) => sum + summarizeReceipt(receipt).baseTotal, 0),
        availableReceiptTotalWithTransport: receipts.reduce((sum, receipt) => sum + summarizeReceipt(receipt).totalWithTransport, 0),
      },
      alerts: Array.from(new Set(alerts)),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron obtener las sugerencias" }, { status: 500 })
  }
})
