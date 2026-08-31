import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { deleteCurrentExpense } from "@/lib/pagos"
import { paymentErrorResponse } from "@/lib/pagos-http"

export const DELETE = withAuth(async (_req, session, context) => {
  try {
    const { id } = await context.params
    const expense = await deleteCurrentExpense({ id: session.user.id, role: session.user.role }, id)
    return NextResponse.json({ ok: true, expense })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
