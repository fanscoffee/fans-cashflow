import { NextResponse } from "next/server"
import { PaymentDomainError, paymentEntitySchema, serializePaymentError } from "@/lib/pagos"

export function paymentErrorResponse(error: unknown) {
  const result = serializePaymentError(error)
  return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
}

export function parseEntity(value: string | null | undefined) {
  if (value === null || value === undefined) return undefined
  const parsed = paymentEntitySchema.safeParse(value)
  if (!parsed.success) throw new PaymentDomainError("Entidad no válida", 400, "INVALID_ENTITY")
  return parsed.data
}
