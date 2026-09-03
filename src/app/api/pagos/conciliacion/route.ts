import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, PaymentDomainError, requireOpenAccountingPeriod, requirePaymentFunction } from "@/lib/payments"
import { paymentErrorResponse, parseEntity } from "@/lib/payments-http"
import { PaymentFunction, PaymentStatus, StatementMovementDirection, StatementMovementStatus } from "@/lib/database-enums"
import { getFirstSearchParam } from "@/lib/request-params"

const reconcileSchema = z.object({ movementId: z.string().min(1).max(100), paymentId: z.string().min(1).max(100) }).strict()

export const GET = withAuth(async (req, session) => {
  try {
    const searchParams = new URL(req.url).searchParams
    const entity = parseEntity(getFirstSearchParam(searchParams, "entity", "entidad"))
    await requirePaymentFunction(session.user.id, PaymentFunction.RECONCILE, entity, session.user.role)
    const movements = await prisma.statementMovement.findMany({
      where: { ...(entity ? { fundsAccount: { entity: entity } } : {}), direction: StatementMovementDirection.OUTFLOW, status: { not: StatementMovementStatus.RECONCILED } },
      include: { fundsAccount: { select: { id: true, entity: true, description: true } }, payment: { select: { id: true, number: true, totalAmount: true, status: true, executedById: true } } },
      orderBy: { valueDate: "desc" },
      take: 500,
    })
    return NextResponse.json(movements)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    const input = reconcileSchema.parse(await req.json())
    const movement = await prisma.statementMovement.findUnique({ where: { id: input.movementId }, include: { fundsAccount: true, payment: true } })
    const payment = await prisma.payment.findUnique({ where: { id: input.paymentId }, include: { fundsAccount: true } })
    if (!movement || !payment) return NextResponse.json({ error: "Movimiento o pago no encontrado" }, { status: 404 })
    await requirePaymentFunction(session.user.id, PaymentFunction.RECONCILE, movement.fundsAccount.entity, session.user.role)
    await requireOpenAccountingPeriod(prisma, payment.entity, payment.paymentDate)
    await requireOpenAccountingPeriod(prisma, movement.fundsAccount.entity, movement.valueDate)
    if (payment.executedById === session.user.id) return NextResponse.json({ error: "La conciliación debe hacerla otra persona" }, { status: 409 })
    if (movement.status === StatementMovementStatus.RECONCILED) return NextResponse.json({ error: "El movimiento ya está conciliado" }, { status: 409 })
    if (movement.direction !== StatementMovementDirection.OUTFLOW) return NextResponse.json({ error: "Solo se pueden casar salidas con pagos" }, { status: 409 })
    if (movement.fundsAccountId !== payment.fundsAccountId) return NextResponse.json({ error: "La cuenta del extracto no coincide con la del pago" }, { status: 409 })
    if (movement.fundsAccount.entity !== payment.entity) return NextResponse.json({ error: "La entidad del extracto no coincide con el pago" }, { status: 409 })
    if (!movement.amount.eq(payment.totalAmount)) return NextResponse.json({ error: "El importe del extracto no coincide con el pago" }, { status: 409 })
    if (payment.status === PaymentStatus.VOID) return NextResponse.json({ error: "No se puede conciliar un pago anulado" }, { status: 409 })
    if (payment.reconciled || payment.status === PaymentStatus.RECONCILED || payment.status === PaymentStatus.CLOSED) return NextResponse.json({ error: "El pago ya está conciliado" }, { status: 409 })

    const result = await prisma.$transaction(async (tx) => {
      const movementChange = await tx.statementMovement.updateMany({
        where: { id: movement.id, status: { not: StatementMovementStatus.RECONCILED }, paymentId: null },
        data: { paymentId: payment.id, status: StatementMovementStatus.RECONCILED, reconciledById: session.user.id, reconciledAt: new Date() },
      })
      if (movementChange.count !== 1) throw new PaymentDomainError("El movimiento ya está conciliado", 409, "ALREADY_RECONCILED")
      const paymentChange = await tx.payment.updateMany({
        where: { id: payment.id, reconciled: false, status: { notIn: [PaymentStatus.VOID, PaymentStatus.RECONCILED, PaymentStatus.CLOSED] } },
        data: { reconciled: true, status: PaymentStatus.RECONCILED },
      })
      if (paymentChange.count !== 1) throw new PaymentDomainError("El pago ya está conciliado", 409, "ALREADY_RECONCILED")
      const [updatedMovement, updatedPayment] = await Promise.all([
        tx.statementMovement.findUnique({ where: { id: movement.id } }),
        tx.payment.findUnique({ where: { id: payment.id } }),
      ])
      await auditPaymentEvent(tx, { actorId: session.user.id, action: "PAGO_CONCILIADO", recordType: "Pago", recordId: payment.id, entity: payment.entity, after: { movementId: movement.id } })
      return { movement: updatedMovement, payment: updatedPayment }
    })
    return NextResponse.json(result)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
