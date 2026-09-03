import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, existingApplicationTotal, PaymentDomainError, requireOpenAccountingPeriod, requirePaymentFunction } from "@/lib/payments"
import { paymentErrorResponse } from "@/lib/payments-http"
import { CurrentExpenseStatus, FundsMovementType, PaymentFunction, PaymentStatus } from "@/lib/database-enums"

const actionSchema = z.object({ action: z.literal("ANULAR"), reason: z.string().trim().min(3).max(500) })

export const GET = withAuth(async (_req, session, context) => {
  try {
    const { id } = await context.params
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        creditor: true,
        paymentMethod: true,
        fundsAccount: true,
        executedBy: { select: { id: true, name: true, email: true } },
        applications: { include: { invoice: true, expense: true, advance: true } },
        approvals: { include: { user: { select: { id: true, name: true, email: true } } } },
        fundsMovement: true,
        statementMovement: true,
      },
    })
    if (!payment) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 })
    await requirePaymentFunction(session.user.id, PaymentFunction.EXECUTE, payment.entity, session.user.role)
    return NextResponse.json(payment)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const PATCH = withAuth(async (req, session, context) => {
  try {
    const { id } = await context.params
    const input = actionSchema.parse(await req.json())
    const payment = await prisma.payment.findUnique({ where: { id }, include: { fundsMovement: true, applications: true } })
    if (!payment) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 })
    await requirePaymentFunction(session.user.id, PaymentFunction.AUTHORIZE, payment.entity, session.user.role)
    await requireOpenAccountingPeriod(prisma, payment.entity, payment.paymentDate)
    if (payment.executedById === session.user.id) return NextResponse.json({ error: "El ejecutor no puede anular su propio pago" }, { status: 409 })
    if (payment.status === PaymentStatus.RECONCILED || payment.status === PaymentStatus.CLOSED) return NextResponse.json({ error: "Un pago conciliado o cerrado es inmutable" }, { status: 409 })
    if (payment.status === PaymentStatus.VOID) return NextResponse.json(payment)

    const updated = await prisma.$transaction(async (tx) => {
      const paymentChange = await tx.payment.updateMany({
        where: { id, status: payment.status, reconciled: false },
        data: { status: PaymentStatus.VOID, voidedById: session.user.id, voidedAt: new Date() },
      })
      if (paymentChange.count !== 1) throw new PaymentDomainError("El pago ya no está disponible para anularse", 409, "PAYMENT_STATE_CHANGED")
      if (payment.fundsMovement) {
        await tx.fundsMovement.create({ data: { fundsAccountId: payment.fundsAccountId, entity: payment.entity, type: FundsMovementType.ADJUSTMENT, amount: payment.totalAmount, description: `Reversión del pago ${payment.number}`, sourceType: "ANULACION_PAGO", sourceId: id, createdById: session.user.id } })
        await tx.fundsAccount.update({ where: { id: payment.fundsAccountId }, data: { theoreticalBalance: { increment: payment.totalAmount } } })
      }

      for (const application of payment.applications) {
        if (application.invoiceId) {
          const invoice = await tx.invoice.findUnique({ where: { id: application.invoiceId }, select: { id: true, confirmedAmount: true } })
          if (invoice?.confirmedAmount) {
            const applied = await existingApplicationTotal(tx, "invoiceId", invoice.id)
            const state = applied.isZero() ? "PENDIENTE" : applied.gte(invoice.confirmedAmount) ? "PAGADA" : "PARCIAL"
            await tx.invoice.update({ where: { id: invoice.id }, data: { paymentStatus: state, paidAmount: applied } })
          }
        }

        if (application.currentExpenseId) {
          const expense = await tx.currentExpense.findUnique({ where: { id: application.currentExpenseId }, select: { id: true, amount: true, status: true } })
          if (expense && expense.status === CurrentExpenseStatus.PAID) {
            const applied = await existingApplicationTotal(tx, "currentExpenseId", expense.id)
            await tx.currentExpense.update({ where: { id: expense.id }, data: { status: applied.gte(expense.amount) ? CurrentExpenseStatus.PAID : CurrentExpenseStatus.AUTHORIZED } })
          }
        }

        if (application.advanceId) {
          const advance = await tx.advance.findUnique({ where: { id: application.advanceId }, select: { id: true, amount: true, appliedAmount: true, status: true } })
          if (advance) {
            const applied = Prisma.Decimal.max(new Prisma.Decimal(0), advance.appliedAmount.minus(application.appliedAmount))
            await tx.advance.update({ where: { id: advance.id }, data: { appliedAmount: applied, status: applied.gte(advance.amount) ? CurrentExpenseStatus.PAID : CurrentExpenseStatus.AUTHORIZED } })
          }
        }
      }
      await auditPaymentEvent(tx, { actorId: session.user.id, action: "PAGO_ANULADO", recordType: "Pago", recordId: id, entity: payment.entity, reason: input.reason, before: { status: payment.status }, after: { status: "ANULADO" } })
      return tx.payment.findUnique({ where: { id } })
    })
    return NextResponse.json(updated)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
