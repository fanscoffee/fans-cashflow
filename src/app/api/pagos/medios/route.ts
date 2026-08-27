import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction } from "@/lib/pagos"
import { paymentErrorResponse } from "@/lib/pagos-http"

const methodSchema = z.object({
  id: z.string().trim().min(1).max(12),
  tipo: z.enum(["TRANSFERENCIA", "DOMICILIACION", "TARJETA", "EFECTIVO", "CHEQUE", "PAGO_MOVIL"]),
  requiereCuenta: z.boolean().default(true),
  conciliableBanco: z.boolean().default(true),
  limiteOperacion: z.coerce.number().finite().positive().optional(),
})

export const GET = withAuth(async (_req, session) => {
  try {
    await requirePaymentFunction(session.user.id, "SOLICITAR", undefined, session.user.role)
    return NextResponse.json(await prisma.medioPago.findMany({ orderBy: { id: "asc" } }))
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    await requirePaymentFunction(session.user.id, "ADMINISTRAR", undefined, session.user.role)
    const input = methodSchema.parse(await req.json())
    const method = await prisma.medioPago.create({ data: { ...input, limiteOperacion: input.limiteOperacion ?? null } })
    await auditPaymentEvent(prisma, { actorId: session.user.id, accion: "MEDIO_PAGO_CREADO", tipoRegistro: "MedioPago", registroId: method.id, despues: input })
    return NextResponse.json(method, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
