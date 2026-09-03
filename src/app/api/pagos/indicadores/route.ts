import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { getIndicators, requirePaymentFunction } from "@/lib/payments"
import { parseEntity, paymentErrorResponse } from "@/lib/payments-http"
import { PaymentEntity, PaymentFunction } from "@/lib/database-enums"
import { getFirstSearchParam } from "@/lib/request-params"

function monthRange(year: number, month: number) {
  return { from: new Date(year, month - 1, 1), to: new Date(year, month, 1) }
}

export const GET = withAuth(async (req, session) => {
  try {
    const params = new URL(req.url).searchParams
    const entity = parseEntity(getFirstSearchParam(params, "entity", "entidad")) || PaymentEntity.BAKERY
    await requirePaymentFunction(session.user.id, PaymentFunction.RECONCILE, entity, session.user.role)
    const now = new Date()
    const year = Number(params.get("year") || now.getFullYear())
    const month = Number(params.get("month") || now.getMonth() + 1)
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return NextResponse.json({ error: "Periodo no válido" }, { status: 400 })
    const range = monthRange(year, month)
    return NextResponse.json({ entity: entity, year, month, metrics: await getIndicators(entity, range.from, range.to) })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
