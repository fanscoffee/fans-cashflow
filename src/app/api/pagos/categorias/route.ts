import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction } from "@/lib/payments"
import { paymentErrorResponse } from "@/lib/payments-http"
import { PaymentFunction } from "@/lib/database-enums"

const categorySchema = z.object({ code: z.string().trim().min(2).max(12), name: z.string().trim().min(2).max(80), description: z.string().trim().max(200).optional() })

export const GET = withAuth(async (_req, session) => {
  try {
    await requirePaymentFunction(session.user.id, PaymentFunction.REQUEST, undefined, session.user.role)
    return NextResponse.json(await prisma.expenseCategory.findMany({ where: { active: true }, orderBy: { code: "asc" } }))
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    await requirePaymentFunction(session.user.id, PaymentFunction.ADMINISTER, undefined, session.user.role)
    const input = categorySchema.parse(await req.json())
    const category = await prisma.expenseCategory.create({ data: { ...input, description: input.description || null } })
    await auditPaymentEvent(prisma, { actorId: session.user.id, action: "CATEGORIA_GASTO_CREADA", recordType: "CategoriaGasto", recordId: category.id, after: input })
    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
