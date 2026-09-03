import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction } from "@/lib/payments"
import { paymentErrorResponse } from "@/lib/payments-http"
import { creditorTypeSchema, paymentEntitySchema, PaymentFunction } from "@/lib/database-enums"

const creditorSchema = z.object({
  code: z.string().trim().min(1).max(12),
  type: creditorTypeSchema,
  name: z.string().trim().min(2).max(80),
  taxId: z.string().trim().max(15).optional(),
  defaultEntity: paymentEntitySchema.optional(),
  destinationAccountLast4: z.string().regex(/^\d{4}$/).optional(),
})

export const GET = withAuth(async (_req, session) => {
  try {
    await requirePaymentFunction(session.user.id, PaymentFunction.REGISTER, undefined, session.user.role)
    const creditors = await prisma.creditor.findMany({ orderBy: { name: "asc" }, take: 500 })
    return NextResponse.json(creditors)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    await requirePaymentFunction(session.user.id, PaymentFunction.ADMINISTER, undefined, session.user.role)
    const input = creditorSchema.parse(await req.json())
    const creditor = await prisma.creditor.create({ data: { ...input, taxId: input.taxId || null, defaultEntity: input.defaultEntity || null, destinationAccountLast4: input.destinationAccountLast4 || null, createdById: session.user.id } })
    await auditPaymentEvent(prisma, { actorId: session.user.id, action: "ACREEDOR_CREADO", recordType: "Acreedor", recordId: creditor.id, entity: input.defaultEntity, after: { code: input.code, type: input.type } })
    return NextResponse.json(creditor, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
