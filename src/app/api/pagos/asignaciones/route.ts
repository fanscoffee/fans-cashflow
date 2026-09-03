import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction } from "@/lib/payments"
import { paymentErrorResponse } from "@/lib/payments-http"
import { paymentEntitySchema, paymentFunctionSchema, PaymentFunction } from "@/lib/database-enums"

const assignmentSchema = z.object({ userId: z.string().min(1), entity: paymentEntitySchema.optional(), function: paymentFunctionSchema })

export const GET = withAuth(async (_req, session) => {
  try {
    await requirePaymentFunction(session.user.id, PaymentFunction.ADMINISTER, undefined, session.user.role)
    return NextResponse.json(await prisma.userPaymentAssignment.findMany({ include: { user: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { createdAt: "desc" } }))
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    await requirePaymentFunction(session.user.id, PaymentFunction.ADMINISTER, undefined, session.user.role)
    const input = assignmentSchema.parse(await req.json())
    const assignment = await prisma.userPaymentAssignment.create({ data: { userId: input.userId, entity: input.entity || null, function: input.function } })
    await auditPaymentEvent(prisma, { actorId: session.user.id, action: "ASIGNACION_PAGO_CREADA", recordType: "AsignacionPagoUsuario", recordId: assignment.id, entity: input.entity, after: input })
    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
