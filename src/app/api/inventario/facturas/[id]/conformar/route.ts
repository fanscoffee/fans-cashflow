import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requireOpenAccountingPeriod, requirePaymentFunction } from "@/lib/payments"
import { paymentErrorResponse } from "@/lib/payments-http"
import { InvoiceWorkflowStatus, PaymentFunction, paymentEntitySchema } from "@/lib/database-enums"

const conformSchema = z.object({
  entity: paymentEntitySchema,
  confirmedAmount: z.coerce.number().finite().positive(),
  withheldAmount: z.coerce.number().finite().min(0).default(0),
  withholdingReason: z.string().trim().max(500).optional(),
  sourceReference: z.string().trim().max(120).optional(),
})

export const PATCH = withAuth(async (req, session, context) => {
  try {
    const { id } = await context.params
    const input = conformSchema.parse(await req.json())
    const invoice = await prisma.invoice.findUnique({ where: { id }, include: { creditor: true } })
    if (!invoice) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
    if (!invoice.creditorId || !invoice.creditor) return NextResponse.json({ error: "La factura no tiene acreedor asociado" }, { status: 409 })
    if (invoice.entity !== input.entity) return NextResponse.json({ error: "La entidad no coincide con la factura" }, { status: 409 })
    if (!([InvoiceWorkflowStatus.DRAFT, InvoiceWorkflowStatus.IN_REVIEW, InvoiceWorkflowStatus.ISSUE] as string[]).includes(invoice.workflowStatus)) {
      return NextResponse.json({ error: "La factura no está disponible para conformarse" }, { status: 409 })
    }
    await requireOpenAccountingPeriod(prisma, input.entity, invoice.issueDate)
    await requirePaymentFunction(session.user.id, PaymentFunction.AUTHORIZE, input.entity, session.user.role)
    const attachment = await prisma.paymentAttachment.findFirst({ where: { invoiceId: id }, select: { id: true } })
    if (!attachment) return NextResponse.json({ error: "La factura necesita un adjunto antes de conformarse" }, { status: 409 })
    if (input.confirmedAmount + input.withheldAmount > Number(invoice.totalAmount)) return NextResponse.json({ error: "El importe conformado y retenido supera el total de la factura" }, { status: 409 })
    if (Math.abs(input.confirmedAmount + input.withheldAmount - Number(invoice.totalAmount)) > 0.009) return NextResponse.json({ error: "El importe debe distribuir exactamente el total de la factura" }, { status: 409 })
    if (input.withheldAmount > 0 && !input.withholdingReason?.trim()) return NextResponse.json({ error: "La retención debe tener un motivo" }, { status: 400 })

    const status = input.withheldAmount > 0 ? InvoiceWorkflowStatus.PARTIALLY_CONFIRMED : InvoiceWorkflowStatus.CONFIRMED
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.invoice.updateMany({
        where: { id, workflowStatus: { in: [InvoiceWorkflowStatus.DRAFT, InvoiceWorkflowStatus.IN_REVIEW, InvoiceWorkflowStatus.ISSUE] } },
        data: { workflowStatus: status, confirmedAmount: input.confirmedAmount, withheldAmount: input.withheldAmount, withholdingReason: input.withholdingReason || null, sourceReference: input.sourceReference || null },
      })
      if (changed.count !== 1) throw new Error("La factura ya no está disponible para conformarse")
      const result = await tx.invoice.findUnique({ where: { id } })
      await auditPaymentEvent(tx, { actorId: session.user.id, action: "FACTURA_CONFORMADA", recordType: "Factura", recordId: id, entity: input.entity, after: { workflowStatus: status, confirmedAmount: input.confirmedAmount, withheldAmount: input.withheldAmount } })
      return result
    })
    return NextResponse.json(updated)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
