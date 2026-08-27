import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction } from "@/lib/pagos"
import { paymentErrorResponse } from "@/lib/pagos-http"

const actionSchema = z.object({ action: z.literal("ANULAR"), motivo: z.string().trim().min(3).max(500) })

export const GET = withAuth(async (_req, session, context) => {
  try {
    const { id } = await context.params
    const payment = await prisma.pago.findUnique({
      where: { id },
      include: {
        acreedor: true,
        medioPago: true,
        cuentaFondos: true,
        ejecutadoPor: { select: { id: true, name: true, email: true } },
        aplicaciones: { include: { factura: true, gasto: true, anticipo: true } },
        aprobaciones: { include: { usuario: { select: { id: true, name: true, email: true } } } },
        movimientoFondos: true,
        movimientoExtracto: true,
      },
    })
    if (!payment) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 })
    await requirePaymentFunction(session.user.id, "EJECUTAR", payment.entidad, session.user.role)
    return NextResponse.json(payment)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const PATCH = withAuth(async (req, session, context) => {
  try {
    const { id } = await context.params
    const input = actionSchema.parse(await req.json())
    const payment = await prisma.pago.findUnique({ where: { id }, include: { movimientoFondos: true } })
    if (!payment) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 })
    await requirePaymentFunction(session.user.id, "AUTORIZAR", payment.entidad, session.user.role)
    if (payment.ejecutadoPorId === session.user.id) return NextResponse.json({ error: "El ejecutor no puede anular su propio pago" }, { status: 409 })
    if (payment.estado === "CONCILIADO" || payment.estado === "CERRADO") return NextResponse.json({ error: "Un pago conciliado o cerrado es inmutable" }, { status: 409 })
    if (payment.estado === "ANULADO") return NextResponse.json(payment)

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.pago.update({ where: { id }, data: { estado: "ANULADO", anuladoPorId: session.user.id, anuladoAt: new Date() } })
      if (payment.movimientoFondos) {
        await tx.movimientoFondos.create({ data: { cuentaFondosId: payment.cuentaFondosId, entidad: payment.entidad, tipo: "AJUSTE", importe: payment.importeTotal, descripcion: `Reversión del pago ${payment.numero}`, origenTipo: "ANULACION_PAGO", origenId: id, creadoPorId: session.user.id } })
        await tx.cuentaFondos.update({ where: { id: payment.cuentaFondosId }, data: { saldoTeorico: { increment: payment.importeTotal } } })
      }
      await auditPaymentEvent(tx, { actorId: session.user.id, accion: "PAGO_ANULADO", tipoRegistro: "Pago", registroId: id, entidad: payment.entidad, motivo: input.motivo, antes: { estado: payment.estado }, despues: { estado: "ANULADO" } })
      return result
    })
    return NextResponse.json(updated)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
