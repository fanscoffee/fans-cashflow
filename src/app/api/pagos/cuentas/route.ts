import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction } from "@/lib/payments"
import { paymentErrorResponse } from "@/lib/payments-http"
import { fundsAccountTypeSchema, paymentEntitySchema, FundsAccountType, FundsMovementType, PaymentFunction } from "@/lib/database-enums"
import { parseEntity } from "@/lib/payments-http"
import { getFirstSearchParam } from "@/lib/request-params"

const openingBalanceSchema = z.coerce.number().finite().min(0)

const accountSchema = z.object({
  id: z.string().trim().min(1).max(12),
  type: fundsAccountTypeSchema,
  entity: paymentEntitySchema,
  description: z.string().trim().min(2).max(60),
  ibanLast4: z.string().regex(/^\d{4}$/).optional(),
  responsibleUserId: z.string().min(1),
  openingBalance: openingBalanceSchema.optional(),
  balanceInicial: openingBalanceSchema.optional(),
  fixedFloat: z.coerce.number().finite().min(0).optional(),
}).transform(({ openingBalance, balanceInicial, ...account }) => ({
  ...account,
  openingBalance: openingBalance ?? balanceInicial ?? 0,
}))

export const GET = withAuth(async (req, session) => {
  try {
    const searchParams = new URL(req.url).searchParams
    const entity = parseEntity(getFirstSearchParam(searchParams, "entity", "entidad"))
    await requirePaymentFunction(session.user.id, PaymentFunction.REQUEST, entity, session.user.role)
    const accounts = await prisma.fundsAccount.findMany({ where: entity ? { entity: entity } : {}, orderBy: [{ entity: "asc" }, { id: "asc" }] })
    return NextResponse.json(accounts)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    await requirePaymentFunction(session.user.id, PaymentFunction.ADMINISTER, undefined, session.user.role)
    const input = accountSchema.parse(await req.json())
    if (input.type === FundsAccountType.PETTY_CASH && input.fixedFloat == null) return NextResponse.json({ error: "La caja chica requiere fondo fijo" }, { status: 400 })
    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.fundsAccount.create({ data: { id: input.id, type: input.type, entity: input.entity, description: input.description, ibanLast4: input.ibanLast4 || null, responsibleUserId: input.responsibleUserId, theoreticalBalance: input.openingBalance, fixedFloat: input.type === FundsAccountType.PETTY_CASH ? input.fixedFloat : null } })
      if (input.openingBalance > 0) {
        await tx.fundsMovement.create({ data: { fundsAccountId: created.id, entity: created.entity, type: FundsMovementType.ALLOCATION_INFLOW, amount: input.openingBalance, description: "Saldo inicial", sourceType: "CONFIGURACION", sourceId: created.id, createdById: session.user.id } })
      }
      await auditPaymentEvent(tx, { actorId: session.user.id, action: "CUENTA_CREADA", recordType: "CuentaFondos", recordId: created.id, entity: created.entity, after: { type: created.type, openingBalance: input.openingBalance } })
      return created
    })
    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
