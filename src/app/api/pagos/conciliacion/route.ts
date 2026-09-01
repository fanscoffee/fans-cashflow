import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, PaymentDomainError, requireOpenAccountingPeriod, requirePaymentFunction } from "@/lib/pagos"
import { paymentErrorResponse, parseEntity } from "@/lib/pagos-http"

const reconcileSchema = z.object({ movimientoId: z.string().min(1).max(100), pagoId: z.string().min(1).max(100) }).strict()

export const GET = withAuth(async (req, session) => {
  try {
    const entity = parseEntity(new URL(req.url).searchParams.get("entidad"))
    await requirePaymentFunction(session.user.id, "CONCILIAR", entity, session.user.role)
    const movements = await prisma.movimientoExtracto.findMany({
      where: { ...(entity ? { cuentaFondos: { entidad: entity } } : {}), direccion: "SALIDA", estado: { not: "CONCILIADO" } },
      include: { cuentaFondos: { select: { id: true, entidad: true, descripcion: true } }, pago: { select: { id: true, numero: true, importeTotal: true, estado: true, ejecutadoPorId: true } } },
      orderBy: { fechaValor: "desc" },
      take: 500,
    })
    return NextResponse.json(movements)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    const input = reconcileSchema.parse(await req.json())
    const movement = await prisma.movimientoExtracto.findUnique({ where: { id: input.movimientoId }, include: { cuentaFondos: true, pago: true } })
    const payment = await prisma.pago.findUnique({ where: { id: input.pagoId }, include: { cuentaFondos: true } })
    if (!movement || !payment) return NextResponse.json({ error: "Movimiento o pago no encontrado" }, { status: 404 })
    await requirePaymentFunction(session.user.id, "CONCILIAR", movement.cuentaFondos.entidad, session.user.role)
    await requireOpenAccountingPeriod(prisma, payment.entidad, payment.fechaPago)
    await requireOpenAccountingPeriod(prisma, movement.cuentaFondos.entidad, movement.fechaValor)
    if (payment.ejecutadoPorId === session.user.id) return NextResponse.json({ error: "La conciliación debe hacerla otra persona" }, { status: 409 })
    if (movement.estado === "CONCILIADO") return NextResponse.json({ error: "El movimiento ya está conciliado" }, { status: 409 })
    if (movement.direccion !== "SALIDA") return NextResponse.json({ error: "Solo se pueden casar salidas con pagos" }, { status: 409 })
    if (movement.cuentaFondosId !== payment.cuentaFondosId) return NextResponse.json({ error: "La cuenta del extracto no coincide con la del pago" }, { status: 409 })
    if (movement.cuentaFondos.entidad !== payment.entidad) return NextResponse.json({ error: "La entidad del extracto no coincide con el pago" }, { status: 409 })
    if (!movement.importe.eq(payment.importeTotal)) return NextResponse.json({ error: "El importe del extracto no coincide con el pago" }, { status: 409 })
    if (payment.estado === "ANULADO") return NextResponse.json({ error: "No se puede conciliar un pago anulado" }, { status: 409 })
    if (payment.conciliado || ["CONCILIADO", "CERRADO"].includes(payment.estado)) return NextResponse.json({ error: "El pago ya está conciliado" }, { status: 409 })

    const result = await prisma.$transaction(async (tx) => {
      const movementChange = await tx.movimientoExtracto.updateMany({
        where: { id: movement.id, estado: { not: "CONCILIADO" }, pagoId: null },
        data: { pagoId: payment.id, estado: "CONCILIADO", conciliadoPorId: session.user.id, conciliadoAt: new Date() },
      })
      if (movementChange.count !== 1) throw new PaymentDomainError("El movimiento ya está conciliado", 409, "ALREADY_RECONCILED")
      const paymentChange = await tx.pago.updateMany({
        where: { id: payment.id, conciliado: false, estado: { notIn: ["ANULADO", "CONCILIADO", "CERRADO"] } },
        data: { conciliado: true, estado: "CONCILIADO" },
      })
      if (paymentChange.count !== 1) throw new PaymentDomainError("El pago ya está conciliado", 409, "ALREADY_RECONCILED")
      const [updatedMovement, updatedPayment] = await Promise.all([
        tx.movimientoExtracto.findUnique({ where: { id: movement.id } }),
        tx.pago.findUnique({ where: { id: payment.id } }),
      ])
      await auditPaymentEvent(tx, { actorId: session.user.id, accion: "PAGO_CONCILIADO", tipoRegistro: "Pago", registroId: payment.id, entidad: payment.entidad, despues: { movimientoId: movement.id } })
      return { movement: updatedMovement, payment: updatedPayment }
    })
    return NextResponse.json(result)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
