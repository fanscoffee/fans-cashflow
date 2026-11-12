import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { isRole } from "@/lib/roles"
import { auditPaymentEvent } from "@/lib/payments"
import { UserRole, AccountingReconciliationStatus } from "@/lib/database-enums"
import {
  lockAccountingInvoice,
  lockInvoice,
  lockReceiptsForInvoice,
  reconciliationErrorResponse,
  ReconciliationError,
  unlinkSchema,
} from "@/lib/accounting-reconciliation"

export const DELETE = withAuth(async (request, session, context) => {
  if (!isRole(session.user.role, UserRole.ADMIN) && !isRole(session.user.role, UserRole.PARTNER)) return NextResponse.json({ error: "Solo ADMIN y SOCIO pueden desvincular capturas" }, { status: 403 })
  const { id } = await context.params

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Indica el motivo de la desvinculación" }, { status: 400 })
    }
    const parsed = unlinkSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Indica el motivo de la desvinculación" }, { status: 400 })

    const result = await prisma.$transaction(async (tx) => {
      await lockAccountingInvoice(tx, id)
      const capture = await tx.accountingInvoice.findUnique({
        where: { id },
        include: { inventoryInvoice: { select: { id: true, entity: true, workflowStatus: true } } },
      })
      if (!capture) throw new ReconciliationError("Factura de gestoría no encontrada", 404, "CAPTURE_NOT_FOUND")
      if (!capture.inventoryInvoiceId || !capture.inventoryInvoice) throw new ReconciliationError("La captura no tiene un vínculo operativo", 409, "CAPTURE_NOT_LINKED")

      await lockInvoice(tx, capture.inventoryInvoiceId)
      const invoice = await tx.invoice.findUnique({ where: { id: capture.inventoryInvoiceId }, select: { id: true, entity: true } })
      if (!invoice) throw new ReconciliationError("La factura operativa vinculada no existe", 409, "INVOICE_NOT_FOUND")

      await lockReceiptsForInvoice(tx, invoice.id)
      const cleared = await tx.receipt.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceId: null } })
      await tx.accountingInvoice.update({
        where: { id },
        data: {
          inventoryInvoiceId: null,
          linkedAt: null,
          linkedById: null,
          reconciliationStatus: AccountingReconciliationStatus.UNLINKED,
        },
      })
      await auditPaymentEvent(tx, {
        actorId: session.user.id,
        action: "FACTURA_GESTORIA_DESVINCULADA",
        recordType: "FacturaGestoria",
        recordId: id,
        entity: invoice.entity,
        reason: parsed.data.reason,
        before: { inventoryInvoiceId: invoice.id, receiptCount: cleared.count },
        after: { inventoryInvoiceId: null, reconciliationStatus: AccountingReconciliationStatus.UNLINKED },
      })

      return { ok: true, accountingInvoiceId: id, invoiceId: invoice.id, unlinkedReceipts: cleared.count }
    })

    return NextResponse.json(result)
  } catch (error) {
    const response = reconciliationErrorResponse(error)
    const { status, ...body } = response
    return NextResponse.json(body, { status })
  }
})
