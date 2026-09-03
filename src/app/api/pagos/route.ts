import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { createPayment, createPaymentSchema, getPaymentDashboard, requirePaymentFunction } from "@/lib/payments"
import { parseEntity, paymentErrorResponse } from "@/lib/payments-http"
import { PaymentFunction } from "@/lib/database-enums"
import { getFirstSearchParam } from "@/lib/request-params"

export const GET = withAuth(async (req, session) => {
  try {
    const searchParams = new URL(req.url).searchParams
    const entity = parseEntity(getFirstSearchParam(searchParams, "entity", "entidad"))
    // The dashboard contains balances and creditor data, not just public status.
    await requirePaymentFunction(session.user.id, PaymentFunction.REQUEST, entity, session.user.role)
    const dashboard = await getPaymentDashboard(entity)
    return NextResponse.json(dashboard)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    const input = createPaymentSchema.parse(await req.json())
    const payment = await createPayment({ id: session.user.id, role: session.user.role }, input)
    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
