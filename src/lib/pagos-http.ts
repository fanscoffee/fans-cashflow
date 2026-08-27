import { NextResponse } from "next/server"
import { paymentEntitySchema, serializePaymentError } from "@/lib/pagos"

export function paymentErrorResponse(error: unknown) {
  const result = serializePaymentError(error)
  return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
}

export function parseEntity(value: string | null | undefined) {
  if (!value) return undefined
  const parsed = paymentEntitySchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}
