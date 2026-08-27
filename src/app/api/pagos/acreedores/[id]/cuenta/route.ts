import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction } from "@/lib/pagos"
import { paymentErrorResponse } from "@/lib/pagos-http"

const changeSchema = z.object({ cuentaNueva4: z.string().regex(/^\d{4}$/), motivo: z.string().trim().min(3).max(500) })
const authorizeSchema = z.object({ accion: z.literal("AUTORIZAR"), confirmacionCanal: z.string().trim().min(2).max(80) })

export const GET = withAuth(async (_req, session, context) => {
  try {
    const { id } = await context.params
    await requirePaymentFunction(session.user.id, "ADMINISTRAR", undefined, session.user.role)
    return NextResponse.json(await prisma.cambioCuentaAcreedor.findMany({ where: { acreedorId: id }, include: { solicitadoPor: { select: { id: true, name: true, email: true } }, autorizadoPor: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } }))
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session, context) => {
  try {
    const { id } = await context.params
    const input = changeSchema.parse(await req.json())
    const creditor = await prisma.acreedor.findUnique({ where: { id }, select: { id: true, entidadHabitual: true, cuentaDestinoUltimos4: true, estado: true } })
    if (!creditor || creditor.estado !== "ACTIVO") return NextResponse.json({ error: "Acreedor no disponible" }, { status: 409 })
    await requirePaymentFunction(session.user.id, "ADMINISTRAR", creditor.entidadHabitual || undefined, session.user.role)
    const change = await prisma.cambioCuentaAcreedor.create({ data: { acreedorId: id, cuentaAnterior4: creditor.cuentaDestinoUltimos4, cuentaNueva4: input.cuentaNueva4, motivo: input.motivo, solicitadoPorId: session.user.id } })
    await auditPaymentEvent(prisma, { actorId: session.user.id, accion: "CAMBIO_CUENTA_SOLICITADO", tipoRegistro: "Acreedor", registroId: id, entidad: creditor.entidadHabitual || undefined, motivo: input.motivo, despues: { cambioId: change.id, cuentaNueva4: input.cuentaNueva4 } })
    return NextResponse.json(change, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const PATCH = withAuth(async (req, session, context) => {
  try {
    const { id } = await context.params
    const input = authorizeSchema.parse(await req.json())
    const change = await prisma.cambioCuentaAcreedor.findUnique({ where: { id }, include: { acreedor: true } })
    if (!change) return NextResponse.json({ error: "Solicitud de cambio no encontrada" }, { status: 404 })
    await requirePaymentFunction(session.user.id, "AUTORIZAR", change.acreedor.entidadHabitual || undefined, session.user.role)
    if (change.solicitadoPorId === session.user.id) return NextResponse.json({ error: "La segunda autorización debe ser de otra persona" }, { status: 409 })
    if (change.estado !== "PENDIENTE") return NextResponse.json({ error: "El cambio ya fue resuelto" }, { status: 409 })
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.cambioCuentaAcreedor.update({ where: { id }, data: { estado: "AUTORIZADO", autorizadoPorId: session.user.id, autorizadoAt: new Date(), confirmacionCanal: input.confirmacionCanal } })
      await tx.acreedor.update({ where: { id: change.acreedorId }, data: { cuentaDestinoUltimos4: change.cuentaNueva4 } })
      await auditPaymentEvent(tx, { actorId: session.user.id, accion: "CAMBIO_CUENTA_AUTORIZADO", tipoRegistro: "Acreedor", registroId: change.acreedorId, entidad: change.acreedor.entidadHabitual || undefined, despues: { cambioId: id, cuentaNueva4: change.cuentaNueva4, canal: input.confirmacionCanal } })
      return result
    })
    return NextResponse.json(updated)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
