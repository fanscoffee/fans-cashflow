import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction } from "@/lib/payments"
import { paymentErrorResponse } from "@/lib/payments-http"
import { paymentEntitySchema, paymentFunctionSchema, PaymentFunction } from "@/lib/database-enums"

const parameterSchema = z.discriminatedUnion("recordType", [
  z.object({ recordType: z.literal("PARAMETRO"), entity: paymentEntitySchema.optional(), code: z.string().trim().min(2).max(80), decimalValue: z.coerce.number().finite().optional(), textValue: z.string().trim().max(200).optional() }),
  z.object({ recordType: z.literal("REGLA"), entity: paymentEntitySchema.optional(), amountFrom: z.coerce.number().finite().min(0), amountTo: z.coerce.number().finite().positive().optional(), requiredFunction: paymentFunctionSchema }),
])

export const GET = withAuth(async (_req, session) => {
  try {
    await requirePaymentFunction(session.user.id, PaymentFunction.ADMINISTER, undefined, session.user.role)
    const [parameters, rules] = await Promise.all([
      prisma.authorizationParameter.findMany({ where: { active: true }, orderBy: [{ code: "asc" }, { version: "desc" }] }),
      prisma.authorizationRule.findMany({ where: { active: true }, orderBy: [{ amountFrom: "asc" }, { version: "desc" }] }),
    ])
    return NextResponse.json({ parameters, rules })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    await requirePaymentFunction(session.user.id, PaymentFunction.ADMINISTER, undefined, session.user.role)
    const input = parameterSchema.parse(await req.json())
    if (input.recordType === "PARAMETRO") {
      const current = await prisma.authorizationParameter.findFirst({ where: { code: input.code, entity: input.entity || null }, orderBy: { version: "desc" }, select: { version: true } })
      const created = await prisma.$transaction(async (tx) => {
        await tx.authorizationParameter.updateMany({ where: { code: input.code, entity: input.entity || null, active: true }, data: { active: false, validTo: new Date() } })
        const result = await tx.authorizationParameter.create({ data: { entity: input.entity || null, code: input.code, decimalValue: input.decimalValue ?? null, textValue: input.textValue || null, version: (current?.version || 0) + 1, changedById: session.user.id } })
        await auditPaymentEvent(tx, { actorId: session.user.id, action: "PARAMETRO_ACTUALIZADO", recordType: "ParametroAutorizacion", recordId: result.id, entity: input.entity, after: input })
        return result
      })
      return NextResponse.json(created, { status: 201 })
    }

    const created = await prisma.authorizationRule.create({ data: { entity: input.entity || null, amountFrom: input.amountFrom, amountTo: input.amountTo ?? null, requiredFunction: input.requiredFunction, changedById: session.user.id } })
    await auditPaymentEvent(prisma, { actorId: session.user.id, action: "REGLA_AUTORIZACION_CREADA", recordType: "ReglaAutorizacion", recordId: created.id, entity: input.entity, after: input })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
