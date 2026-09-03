import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, PaymentDomainError, requireOpenAccountingPeriod, requirePaymentFunction } from "@/lib/payments"
import { paymentErrorResponse, parseEntity } from "@/lib/payments-http"
import { CashCountStatus, CashReplenishmentStatus, FundsAccountStatus, FundsAccountType, FundsMovementType, PaymentFunction } from "@/lib/database-enums"
import { getFirstSearchParam } from "@/lib/request-params"

const cashSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ARQUEO"),
    fundsAccountId: z.string().min(1),
    date: z.string().min(1),
    custodianId: z.string().min(1),
    countedCash: z.coerce.number().finite().min(0),
    receipts: z.coerce.number().finite().min(0),
    notes: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal("REPONER"),
    fundsAccountId: z.string().min(1),
    cashCountId: z.string().min(1),
    amount: z.coerce.number().finite().positive(),
    justifiedAmount: z.coerce.number().finite().positive(),
  }),
])

export const GET = withAuth(async (req, session) => {
  const searchParams = new URL(req.url).searchParams
  const entity = parseEntity(getFirstSearchParam(searchParams, "entity", "entidad"))
  try {
    await requirePaymentFunction(session.user.id, PaymentFunction.RECONCILE, entity, session.user.role)
    const [accounts, counts, replenishments] = await Promise.all([
      prisma.fundsAccount.findMany({ where: { ...(entity ? { entity: entity } : {}), type: FundsAccountType.PETTY_CASH, status: FundsAccountStatus.ACTIVE }, orderBy: { id: "asc" } }),
      prisma.cashCount.findMany({ where: { fundsAccount: entity ? { entity: entity } : undefined }, include: { fundsAccount: true, custodian: { select: { name: true, email: true } }, verifier: { select: { name: true, email: true } } }, orderBy: { date: "desc" }, take: 100 }),
      prisma.cashReplenishment.findMany({ where: { fundsAccount: entity ? { entity: entity } : undefined }, include: { fundsAccount: true, cashCount: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    ])
    return NextResponse.json({ accounts, counts, replenishments })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    const input = cashSchema.parse(await req.json())
    const account = await prisma.fundsAccount.findUnique({ where: { id: input.fundsAccountId } })
    if (!account || account.type !== FundsAccountType.PETTY_CASH || account.status !== FundsAccountStatus.ACTIVE) return NextResponse.json({ error: "La cuenta no es una caja chica activa" }, { status: 409 })
    await requirePaymentFunction(session.user.id, input.action === "ARQUEO" ? PaymentFunction.RECONCILE : PaymentFunction.EXECUTE, account.entity, session.user.role)

    if (input.action === "ARQUEO") {
      if (input.custodianId === session.user.id) return NextResponse.json({ error: "El verificador debe ser distinto del custodio" }, { status: 409 })
      if (account.responsibleUserId !== input.custodianId) return NextResponse.json({ error: "El custodio no coincide con el responsable de la caja" }, { status: 409 })
      const date = new Date(input.date)
      if (!Number.isFinite(date.getTime())) return NextResponse.json({ error: "Fecha de arqueo no válida" }, { status: 400 })
      await requireOpenAccountingPeriod(prisma, account.entity, date)
      const fund = Number(account.fixedFloat || 0)
      const difference = Number((input.countedCash + input.receipts - fund).toFixed(2))
      const count = await prisma.cashCount.create({ data: { fundsAccountId: account.id, date: date, custodianId: input.custodianId, verifierId: session.user.id, countedCash: input.countedCash, receipts: input.receipts, fixedFloat: fund, variance: difference, status: difference === 0 ? CashCountStatus.VALIDATED : CashCountStatus.ISSUE, notes: input.notes || null } })
      await auditPaymentEvent(prisma, { actorId: session.user.id, action: "ARQUEO_CAJA", recordType: "ArqueoCaja", recordId: count.id, entity: account.entity, after: { variance: difference } })
      return NextResponse.json(count, { status: 201 })
    }

    if (Math.abs(input.amount - input.justifiedAmount) > 0.009) return NextResponse.json({ error: "La reposición debe coincidir exactamente con lo justificado" }, { status: 409 })
    const count = await prisma.cashCount.findUnique({ where: { id: input.cashCountId } })
    if (!count || count.fundsAccountId !== account.id || count.status !== CashCountStatus.VALIDATED) return NextResponse.json({ error: "El arqueo no es válido para reponer" }, { status: 409 })
    await requireOpenAccountingPeriod(prisma, account.entity, count.date)
    const replenishment = await prisma.$transaction(async (tx) => {
      const existingReplenishment = await tx.cashReplenishment.findUnique({ where: { cashCountId: input.cashCountId }, select: { id: true } })
      if (existingReplenishment) throw new PaymentDomainError("El arqueo ya tiene una reposición ejecutada", 409, "CASH_COUNT_ALREADY_REPLENISHED")
      const created = await tx.cashReplenishment.create({ data: { fundsAccountId: account.id, cashCountId: input.cashCountId || null, amount: input.amount, justifiedAmount: input.justifiedAmount, status: CashReplenishmentStatus.EXECUTED, createdById: session.user.id, executedAt: new Date() } })
      await tx.fundsMovement.create({ data: { fundsAccountId: account.id, entity: account.entity, type: FundsMovementType.CASH_REPLENISHMENT, amount: input.amount, description: "Reposición de caja chica", sourceType: "REPOSICION_CAJA", sourceId: created.id, createdById: session.user.id } })
      await tx.fundsAccount.update({ where: { id: account.id }, data: { theoreticalBalance: { increment: input.amount } } })
      await auditPaymentEvent(tx, { actorId: session.user.id, action: "CAJA_REPUESTA", recordType: "ReposicionCaja", recordId: created.id, entity: account.entity, after: { amount: input.amount } })
      return created
    })
    return NextResponse.json(replenishment, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
