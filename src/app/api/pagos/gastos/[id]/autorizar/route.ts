import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { authorizeExpense, authorizeExpenseSchema } from "@/lib/pagos"
import { paymentErrorResponse } from "@/lib/pagos-http"

export const PATCH = withAuth(async (req, session, context) => {
  try {
    const { id } = await context.params
    const input = authorizeExpenseSchema.parse(await req.json())
    const expense = await authorizeExpense({ id: session.user.id, role: session.user.role }, id, input)
    return NextResponse.json(expense)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
