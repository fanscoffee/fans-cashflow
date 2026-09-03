import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { createAdvance, createAdvanceSchema, requirePaymentFunction } from "@/lib/payments"
import { paymentErrorResponse, parseEntity } from "@/lib/payments-http"
import { prisma } from "@/lib/prisma"
import { PaymentFunction, PaymentStatus } from "@/lib/database-enums"
import { getFirstSearchParam } from "@/lib/request-params"

export const GET = withAuth(async (req, session) => {
  try {
    const searchParams = new URL(req.url).searchParams
    const entity = parseEntity(getFirstSearchParam(searchParams, "entity", "entidad"))
    await requirePaymentFunction(session.user.id, PaymentFunction.REQUEST, entity, session.user.role)
    const advances = await prisma.advance.findMany({ where: entity ? { entity: entity } : {}, include: { creditor: { select: { id: true, name: true } }, requestedBy: { select: { id: true, name: true, email: true } }, authorizedBy: { select: { id: true, name: true, email: true } }, applications: { where: { payment: { status: { not: PaymentStatus.VOID } } } } }, orderBy: { date: "desc" }, take: 200 })
    return NextResponse.json(advances)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    const input = createAdvanceSchema.parse(await req.json())
    const advance = await createAdvance({ id: session.user.id, role: session.user.role }, input)
    return NextResponse.json(advance, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
