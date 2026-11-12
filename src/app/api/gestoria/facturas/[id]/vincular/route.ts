import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { canAccessAccounting } from "@/lib/accounting-invoices"
import { auditPaymentEvent, ensureCreditorForSupplier } from "@/lib/payments"
import { AccountingReconciliationStatus, PaymentDocumentType } from "@/lib/database-enums"
import {
  buildOperationalInvoiceDraft,
  lockAccountingInvoice,
  lockReceipts,
  reconciliationErrorResponse,
  reconciliationLinkSchema,
  ReconciliationError,
  resolveSupplierForLink,
  type AccountingCaptureForReconciliation,
  type ReconciliationReceipt,
  type ReconciliationSupplier,
} from "@/lib/accounting-reconciliation"

function jsonAlerts(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

export const POST = withAuth(async (request, session, context) => {
  if (!canAccessAccounting(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await context.params

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Datos no válidos" }, { status: 400 })
    }
    const parsed = reconciliationLinkSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    const input = { ...parsed.data, receiptIds: Array.from(new Set(parsed.data.receiptIds)) }

    const result = await prisma.$transaction(async (tx) => {
      await lockAccountingInvoice(tx, id)
      const capture = await tx.accountingInvoice.findUnique({
        where: { id },
        include: {
          supplier: { select: { id: true, legalName: true, taxId: true, billingAddress: true } },
          inventoryInvoice: {
            select: {
              id: true,
              series: true,
              number: true,
              workflowStatus: true,
              alerts: true,
              deliveryNotes: { select: { id: true } },
            },
          },
        },
      })
      if (!capture) throw new ReconciliationError("Factura de gestoría no encontrada", 404, "CAPTURE_NOT_FOUND")

      if (capture.inventoryInvoiceId) {
        const existingReceiptIds = capture.inventoryInvoice?.deliveryNotes.map((receipt) => receipt.id).sort() || []
        const requestedReceiptIds = [...input.receiptIds].sort()
        if (existingReceiptIds.length === requestedReceiptIds.length && existingReceiptIds.every((receiptId, index) => receiptId === requestedReceiptIds[index])) {
          return {
            idempotent: true,
            accountingInvoice: capture,
            invoice: capture.inventoryInvoice,
            alerts: jsonAlerts(capture.inventoryInvoice?.alerts),
          }
        }
        throw new ReconciliationError("La captura ya está vinculada a otra selección de albaranes", 409, "CAPTURE_ALREADY_LINKED")
      }

      const suppliers = await tx.supplier.findMany({
        select: { id: true, legalName: true, taxId: true, billingAddress: true },
      }) as ReconciliationSupplier[]
      const resolved = resolveSupplierForLink(
        capture as unknown as AccountingCaptureForReconciliation,
        suppliers,
        input.supplierId,
        input.providerExceptionReason,
      )

      const lockedReceiptRows = await lockReceipts(tx, input.receiptIds)
      if (lockedReceiptRows.length !== input.receiptIds.length) {
        throw new ReconciliationError("Uno o más albaranes no existen", 409, "RECEIPT_NOT_FOUND")
      }

      const receipts = await tx.receipt.findMany({
        where: { id: { in: input.receiptIds }, supplierId: resolved.supplier.id, invoiceId: null },
        include: {
          lines: {
            include: {
              product: { select: { code: true, posDescription: true, purchaseUnit: true, purchaseVatPercentage: true } },
            },
          },
        },
      }) as unknown as ReconciliationReceipt[]
      if (receipts.length !== input.receiptIds.length) {
        throw new ReconciliationError("Uno o más albaranes ya están vinculados, no existen o pertenecen a otro proveedor", 409, "RECEIPT_NOT_AVAILABLE")
      }

      const draft = buildOperationalInvoiceDraft({
        capture: capture as unknown as AccountingCaptureForReconciliation,
        supplier: resolved.supplier,
        receipts,
        entity: input.entity,
        includeTransport: input.includeTransport,
        providerExceptionReason: input.providerExceptionReason,
      })

      const existingInvoice = await tx.invoice.findUnique({
        where: { supplierId_series_number: { supplierId: resolved.supplier.id, series: draft.series, number: draft.number } },
        select: { id: true },
      })
      if (existingInvoice) throw new ReconciliationError("Ya existe una factura operativa con ese proveedor, serie y número", 409, "OPERATIONAL_INVOICE_DUPLICATE")

      const creditor = await ensureCreditorForSupplier(tx, resolved.supplier, session.user.id)
      const invoice = await tx.invoice.create({
        data: {
          supplierId: resolved.supplier.id,
          creditorId: creditor.id,
          entity: input.entity,
          documentType: PaymentDocumentType.MERCHANDISE_PURCHASE,
          workflowStatus: draft.workflowStatus,
          confirmedAmount: null,
          withheldAmount: 0,
          withholdingReason: null,
          sourceReference: `GESTORIA:${capture.id}`,
          series: draft.series,
          number: draft.number,
          issueDate: draft.issueDate,
          operationDate: draft.operationDate,
          dueDate: null,
          paymentDate: null,
          orderNumber: null,
          orderDate: null,
          deliveryCenter: null,
          deliveryNoteReference: draft.deliveryNoteReference || null,
          deliveryNoteDate: draft.deliveryNoteDate,
          paymentMethod: draft.paymentMethod,
           status: "BORRADOR",
          paymentStatus: "PENDIENTE",
          currency: "EUR",
          paidAmount: null,
          issuerLegalName: draft.issuerLegalName,
          issuerTaxId: draft.issuerTaxId,
          issuerBillingAddress: draft.issuerBillingAddress,
          netTotal: draft.netTotal,
          discountTotal: 0,
          totalVat: draft.totalVat,
          surchargeTotal: 0,
          withholdingTotal: draft.withholdingTotal,
          totalAmount: draft.totalAmount,
          notes: capture.concept ? `Captura de gestoría: ${capture.concept}` : `Generada desde captura de gestoría ${capture.id}`,
          alerts: draft.alerts.length ? draft.alerts : undefined,
          confirmedById: session.user.id,
          lines: { create: draft.lines },
          taxes: { create: draft.taxes },
        },
      })

      const linkedReceipts = await tx.receipt.updateMany({
        where: { id: { in: input.receiptIds }, invoiceId: null },
        data: { invoiceId: invoice.id },
      })
      if (linkedReceipts.count !== input.receiptIds.length) throw new ReconciliationError("Los albaranes cambiaron durante la vinculación", 409, "RECEIPT_CONCURRENCY")

      await tx.accountingInvoice.update({
        where: { id: capture.id },
        data: {
          supplierId: resolved.supplier.id,
          inventoryInvoiceId: invoice.id,
          linkedAt: new Date(),
          linkedById: session.user.id,
          reconciliationStatus: draft.alerts.length ? AccountingReconciliationStatus.ISSUE : AccountingReconciliationStatus.LINKED,
        },
      })

      await auditPaymentEvent(tx, {
        actorId: session.user.id,
        action: "FACTURA_GESTORIA_VINCULADA",
        recordType: "FacturaGestoria",
        recordId: capture.id,
        entity: input.entity,
        reason: input.providerExceptionReason,
        after: {
          inventoryInvoiceId: invoice.id,
          receiptIds: input.receiptIds,
          reconciliationStatus: draft.alerts.length ? AccountingReconciliationStatus.ISSUE : AccountingReconciliationStatus.LINKED,
          workflowStatus: draft.workflowStatus,
          alerts: draft.alerts,
        },
      })

      return { idempotent: false, accountingInvoice: { ...capture, ...{ supplierId: resolved.supplier.id, inventoryInvoiceId: invoice.id } }, invoice, alerts: draft.alerts }
    })

    return NextResponse.json(result, { status: result.idempotent ? 200 : 201 })
  } catch (error) {
    const response = reconciliationErrorResponse(error)
    const { status, ...body } = response
    return NextResponse.json(body, { status })
  }
})
