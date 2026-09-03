import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { getIndicators, requirePaymentFunction } from "@/lib/payments"
import { prisma } from "@/lib/prisma"
import { paymentErrorResponse } from "@/lib/payments-http"
import { MonthlyCloseStatus, PaymentFunction, paymentEntitySchema, StatementMovementDirection, StatementMovementStatus } from "@/lib/database-enums"
import { parseEntity } from "@/lib/payments-http"
import { getFirstSearchParam } from "@/lib/request-params"

const closeSchema = z.object({ entity: paymentEntitySchema, year: z.coerce.number().int().min(2020).max(2100), month: z.coerce.number().int().min(1).max(12), notes: z.string().trim().max(500).optional() })

export const GET = withAuth(async (req, session) => {
  const params = new URL(req.url).searchParams
  const entity = parseEntity(getFirstSearchParam(params, "entity", "entidad"))
  const where = entity ? { entity } : {}
  try {
    await requirePaymentFunction(session.user.id, PaymentFunction.RECONCILE, entity, session.user.role)
    return NextResponse.json(await prisma.monthlyClose.findMany({ where, include: { metrics: true, closedBy: { select: { name: true, email: true } } }, orderBy: [{ year: "desc" }, { month: "desc" }] }))
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    const input = closeSchema.parse(await req.json())
    await requirePaymentFunction(session.user.id, PaymentFunction.RECONCILE, input.entity, session.user.role)
    const from = new Date(input.year, input.month - 1, 1)
    const to = new Date(input.year, input.month, 1)
    const existingClose = await prisma.monthlyClose.findUnique({
      where: { entity_year_month: { entity: input.entity, year: input.year, month: input.month } },
      select: { status: true },
    })
    if (existingClose && existingClose.status !== MonthlyCloseStatus.OPEN) {
      return NextResponse.json({ error: "El periodo contable ya está cerrado" }, { status: 409 })
    }
    const unexplained = await prisma.statementMovement.count({ where: { fundsAccount: { entity: input.entity }, direction: StatementMovementDirection.OUTFLOW, valueDate: { gte: from, lt: to }, status: { not: StatementMovementStatus.RECONCILED } } })
    if (unexplained > 0) return NextResponse.json({ error: "No se puede cerrar: hay movimientos bancarios sin conciliar", pending: unexplained, pendientes: unexplained }, { status: 409 })
    const indicators = await getIndicators(input.entity, from, to)
    const close = await prisma.$transaction(async (tx) => {
      const created = await tx.monthlyClose.upsert({ where: { entity_year_month: { entity: input.entity, year: input.year, month: input.month } }, create: { entity: input.entity, year: input.year, month: input.month, status: MonthlyCloseStatus.CLOSED, closedById: session.user.id, closedAt: new Date(), notes: input.notes || null }, update: { status: MonthlyCloseStatus.CLOSED, closedById: session.user.id, closedAt: new Date(), notes: input.notes || null } })
      await tx.closeMetric.deleteMany({ where: { closeId: created.id } })
      const entries = Object.entries(indicators).map(([code, value]) => {
        const record = value && typeof value === "object" && "quantity" in value ? value as { quantity?: unknown; amount?: unknown; percentage?: unknown } : { amount: value }
        return { closeId: created.id, code, quantity: record.quantity == null ? null : Number(record.quantity), amount: record.amount == null ? null : Number(record.amount), percentage: record.percentage == null ? null : Number(record.percentage) }
      })
      await tx.closeMetric.createMany({ data: entries })
      return tx.monthlyClose.findUnique({ where: { id: created.id }, include: { metrics: true } })
    })
    return NextResponse.json(close)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
