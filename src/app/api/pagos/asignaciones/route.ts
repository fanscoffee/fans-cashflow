import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction } from "@/lib/pagos"
import { paymentErrorResponse } from "@/lib/pagos-http"

const assignmentSchema = z.object({ userId: z.string().min(1), entidad: z.enum(["OBRADOR", "CAFETERIA"]).optional(), funcion: z.enum(["REGISTRAR", "SOLICITAR", "AUTORIZAR", "EJECUTAR", "CONCILIAR", "ADMINISTRAR"]) })

export const GET = withAuth(async (_req, session) => {
  try {
    await requirePaymentFunction(session.user.id, "ADMINISTRAR", undefined, session.user.role)
    return NextResponse.json(await prisma.asignacionPagoUsuario.findMany({ include: { user: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { createdAt: "desc" } }))
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    await requirePaymentFunction(session.user.id, "ADMINISTRAR", undefined, session.user.role)
    const input = assignmentSchema.parse(await req.json())
    const assignment = await prisma.asignacionPagoUsuario.create({ data: { userId: input.userId, entidad: input.entidad || null, funcion: input.funcion } })
    await auditPaymentEvent(prisma, { actorId: session.user.id, accion: "ASIGNACION_PAGO_CREADA", tipoRegistro: "AsignacionPagoUsuario", registroId: assignment.id, entidad: input.entidad, despues: input })
    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
