import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction } from "@/lib/pagos"
import { paymentErrorResponse } from "@/lib/pagos-http"

const creditorSchema = z.object({
  codigo: z.string().trim().min(1).max(12),
  tipo: z.enum(["PROVEEDOR_MERCANCIA", "SERVICIOS", "PERSONAL", "ADMINISTRACION", "OTROS"]),
  nombre: z.string().trim().min(2).max(80),
  nif: z.string().trim().max(15).optional(),
  entidadHabitual: z.enum(["OBRADOR", "CAFETERIA"]).optional(),
  cuentaDestinoUltimos4: z.string().regex(/^\d{4}$/).optional(),
})

export const GET = withAuth(async (_req, session) => {
  try {
    await requirePaymentFunction(session.user.id, "REGISTRAR", undefined, session.user.role)
    const acreedores = await prisma.acreedor.findMany({ orderBy: { nombre: "asc" }, take: 500 })
    return NextResponse.json(acreedores)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    await requirePaymentFunction(session.user.id, "ADMINISTRAR", undefined, session.user.role)
    const input = creditorSchema.parse(await req.json())
    const creditor = await prisma.acreedor.create({ data: { ...input, nif: input.nif || null, entidadHabitual: input.entidadHabitual || null, cuentaDestinoUltimos4: input.cuentaDestinoUltimos4 || null, createdById: session.user.id } })
    await auditPaymentEvent(prisma, { actorId: session.user.id, accion: "ACREEDOR_CREADO", tipoRegistro: "Acreedor", registroId: creditor.id, entidad: input.entidadHabitual, despues: { codigo: input.codigo, tipo: input.tipo } })
    return NextResponse.json(creditor, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
