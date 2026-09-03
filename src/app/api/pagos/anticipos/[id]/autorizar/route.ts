import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { authorizeAdvance, authorizeAdvanceSchema } from "@/lib/payments"
import { paymentErrorResponse } from "@/lib/payments-http"

export const PATCH = withAuth(async (req, session, context) => {
  try {
    const { id } = await context.params
    const input = authorizeAdvanceSchema.parse(await req.json())
    const advance = await authorizeAdvance({ id: session.user.id, role: session.user.role }, id, input)
    return NextResponse.json(advance)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
