import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction } from "@/lib/payments"
import { paymentErrorResponse } from "@/lib/payments-http"
import { paymentMethodTypeSchema, PaymentFunction } from "@/lib/database-enums"

const methodSchema = z.object({
  id: z.string().trim().min(1).max(12),
  type: paymentMethodTypeSchema,
  requiresAccount: z.boolean().default(true),
  bankReconciliable: z.boolean().default(true),
  transactionLimit: z.coerce.number().finite().positive().optional(),
})

export const GET = withAuth(async (_req, session) => {
  try {
    await requirePaymentFunction(session.user.id, PaymentFunction.REQUEST, undefined, session.user.role)
    return NextResponse.json(await prisma.paymentMethod.findMany({ orderBy: { id: "asc" } }))
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    await requirePaymentFunction(session.user.id, PaymentFunction.ADMINISTER, undefined, session.user.role)
    const input = methodSchema.parse(await req.json())
    const method = await prisma.paymentMethod.create({ data: { ...input, transactionLimit: input.transactionLimit ?? null } })
    await auditPaymentEvent(prisma, { actorId: session.user.id, action: "MEDIO_PAGO_CREADO", recordType: "MedioPago", recordId: method.id, after: input })
    return NextResponse.json(method, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
