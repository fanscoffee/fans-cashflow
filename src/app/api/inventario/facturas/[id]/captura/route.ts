import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { hasAnyRole } from "@/lib/roles"
import { AccountingReconciliationStatus, PaymentDocumentType, UserRole } from "@/lib/database-enums"
import { comparableAccountingInvoiceNumber, normalizeAccountingTaxId } from "@/lib/accounting-invoices"
import { auditPaymentEvent } from "@/lib/payments"
import { lockAccountingInvoice, lockInvoice, ReconciliationError, reconciliationErrorResponse } from "@/lib/accounting-reconciliation"

const linkCaptureSchema = z.object({
  accountingInvoiceId: z.string().trim().min(1),
})

export const POST = withAuth(async (request, session, context) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await context.params

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Datos no válidos" }, { status: 400 })
    }
    const parsed = linkCaptureSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 })

    const result = await prisma.$transaction(async (tx) => {
      await lockAccountingInvoice(tx, parsed.data.accountingInvoiceId)
      await lockInvoice(tx, id)

      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: {
          supplier: { select: { id: true, legalName: true, taxId: true } },
          accountingInvoice: { select: { id: true } },
        },
      })
      if (!invoice) throw new ReconciliationError("Factura operativa no encontrada", 404, "INVOICE_NOT_FOUND")
      if (invoice.accountingInvoice) throw new ReconciliationError("La factura operativa ya tiene una captura vinculada", 409, "INVOICE_ALREADY_LINKED")

      const capture = await tx.accountingInvoice.findUnique({ where: { id: parsed.data.accountingInvoiceId } })
      if (!capture) throw new ReconciliationError("Captura de gestoría no encontrada", 404, "CAPTURE_NOT_FOUND")
      if (capture.inventoryInvoiceId) throw new ReconciliationError("La captura ya está vinculada a otra factura operativa", 409, "CAPTURE_ALREADY_LINKED")
      if (capture.documentType === PaymentDocumentType.EXPENSE) throw new ReconciliationError("Una captura de gasto o servicio no se puede vincular a una factura de mercancía", 409, "DOCUMENT_NOT_APPLICABLE")

       const captureNumber = comparableAccountingInvoiceNumber("", capture.invoiceNumber)
       const invoiceNumber = comparableAccountingInvoiceNumber(invoice.series, invoice.number)
      if (!captureNumber || captureNumber !== invoiceNumber) throw new ReconciliationError("El número de la captura no coincide con la factura operativa", 409, "INVOICE_NUMBER_MISMATCH")

      const captureTaxId = normalizeAccountingTaxId(capture.taxId)
      const supplierTaxId = normalizeAccountingTaxId(invoice.supplier.taxId)
      if (!captureTaxId || captureTaxId !== supplierTaxId) throw new ReconciliationError("El NIF de la captura no coincide con el proveedor de la factura", 409, "SUPPLIER_TAX_ID_MISMATCH")

      const linkedAt = new Date()
      const updatedCapture = await tx.accountingInvoice.update({
        where: { id: capture.id },
        data: {
          supplierId: invoice.supplierId,
          inventoryInvoiceId: invoice.id,
          linkedAt,
          linkedById: session.user.id,
          reconciliationStatus: AccountingReconciliationStatus.LINKED,
        },
        select: { id: true, inventoryInvoiceId: true, reconciliationStatus: true },
      })
      await auditPaymentEvent(tx, {
        actorId: session.user.id,
        action: "CAPTURA_GESTORIA_VINCULADA_A_FACTURA",
        recordType: "Factura",
        recordId: invoice.id,
        entity: invoice.entity,
        after: { accountingInvoiceId: capture.id, reconciliationStatus: AccountingReconciliationStatus.LINKED },
      })

      return { invoiceId: invoice.id, accountingInvoice: updatedCapture }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const response = reconciliationErrorResponse(error)
    const { status, ...body } = response
    return NextResponse.json(body, { status })
  }
})
