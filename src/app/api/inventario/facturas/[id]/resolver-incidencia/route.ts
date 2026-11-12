import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { auditPaymentEvent } from "@/lib/payments"
import { AccountingReconciliationStatus, InvoiceWorkflowStatus, UserRole, parseInvoiceWorkflowStatus } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

const resolutionSchema = z.object({
  reason: z.string().trim().min(3, "Indica el motivo de la resolución").max(500, "El motivo no puede superar los 500 caracteres"),
})

export const PATCH = withAuth(async (request, session, context) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) return NextResponse.json({ error: "Solo ADMIN y SOCIO pueden resolver incidencias" }, { status: 403 })

  const { id } = await context.params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Indica el motivo de la resolución" }, { status: 400 })
  }

  const parsed = resolutionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 })

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        entity: true,
        workflowStatus: true,
        paymentStatus: true,
        alerts: true,
        accountingInvoice: { select: { id: true, reconciliationStatus: true } },
      },
    })
    if (!invoice) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
    if (parseInvoiceWorkflowStatus(invoice.workflowStatus) !== InvoiceWorkflowStatus.ISSUE) return NextResponse.json({ error: "La factura no tiene una incidencia pendiente" }, { status: 409 })

    const nextWorkflowStatus = invoice.paymentStatus === "PAGADA" ? InvoiceWorkflowStatus.CONFIRMED : InvoiceWorkflowStatus.DRAFT

    const result = await prisma.$transaction(async (tx) => {
      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          workflowStatus: nextWorkflowStatus,
          alerts: Prisma.JsonNull,
        },
        select: { id: true, workflowStatus: true, paymentStatus: true, alerts: true },
      })

      if (invoice.accountingInvoice) {
        await tx.accountingInvoice.update({
          where: { id: invoice.accountingInvoice.id },
          data: { reconciliationStatus: AccountingReconciliationStatus.LINKED },
        })
      }

      await auditPaymentEvent(tx, {
        actorId: session.user.id,
        action: "FACTURA_INCIDENCIA_RESUELTA",
        recordType: "Factura",
        recordId: id,
        entity: invoice.entity,
        reason: parsed.data.reason,
        before: {
          workflowStatus: invoice.workflowStatus,
          paymentStatus: invoice.paymentStatus,
          alerts: invoice.alerts,
          reconciliationStatus: invoice.accountingInvoice?.reconciliationStatus || null,
        },
        after: {
          workflowStatus: nextWorkflowStatus,
          paymentStatus: invoice.paymentStatus,
          alerts: [],
          reconciliationStatus: invoice.accountingInvoice ? AccountingReconciliationStatus.LINKED : null,
        },
      })

      return updatedInvoice
    })

    return NextResponse.json({ invoice: result, message: "Incidencia resuelta" })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo resolver la incidencia" }, { status: 500 })
  }
})
