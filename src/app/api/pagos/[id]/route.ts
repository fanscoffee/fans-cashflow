import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, existingApplicationTotal, PaymentDomainError, requireOpenAccountingPeriod, requirePaymentFunction } from "@/lib/pagos"
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
    const payment = await prisma.pago.findUnique({ where: { id }, include: { movimientoFondos: true, aplicaciones: true } })
    if (!payment) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 })
    await requirePaymentFunction(session.user.id, "AUTORIZAR", payment.entidad, session.user.role)
    await requireOpenAccountingPeriod(prisma, payment.entidad, payment.fechaPago)
    if (payment.ejecutadoPorId === session.user.id) return NextResponse.json({ error: "El ejecutor no puede anular su propio pago" }, { status: 409 })
    if (payment.estado === "CONCILIADO" || payment.estado === "CERRADO") return NextResponse.json({ error: "Un pago conciliado o cerrado es inmutable" }, { status: 409 })
    if (payment.estado === "ANULADO") return NextResponse.json(payment)

    const updated = await prisma.$transaction(async (tx) => {
      const paymentChange = await tx.pago.updateMany({
        where: { id, estado: payment.estado, conciliado: false },
        data: { estado: "ANULADO", anuladoPorId: session.user.id, anuladoAt: new Date() },
      })
      if (paymentChange.count !== 1) throw new PaymentDomainError("El pago ya no está disponible para anularse", 409, "PAYMENT_STATE_CHANGED")
      if (payment.movimientoFondos) {
        await tx.movimientoFondos.create({ data: { cuentaFondosId: payment.cuentaFondosId, entidad: payment.entidad, tipo: "AJUSTE", importe: payment.importeTotal, descripcion: `Reversión del pago ${payment.numero}`, origenTipo: "ANULACION_PAGO", origenId: id, creadoPorId: session.user.id } })
        await tx.cuentaFondos.update({ where: { id: payment.cuentaFondosId }, data: { saldoTeorico: { increment: payment.importeTotal } } })
      }

      for (const application of payment.aplicaciones) {
        if (application.facturaId) {
          const invoice = await tx.factura.findUnique({ where: { id: application.facturaId }, select: { id: true, importeConformado: true } })
          if (invoice?.importeConformado) {
            const applied = await existingApplicationTotal(tx, "facturaId", invoice.id)
            const state = applied.isZero() ? "PENDIENTE" : applied.gte(invoice.importeConformado) ? "PAGADA" : "PARCIAL"
            await tx.factura.update({ where: { id: invoice.id }, data: { estadoPago: state, importePagado: applied } })
          }
        }

        if (application.gastoId) {
          const expense = await tx.gastoCorriente.findUnique({ where: { id: application.gastoId }, select: { id: true, importe: true, estado: true } })
          if (expense && expense.estado === "PAGADO") {
            const applied = await existingApplicationTotal(tx, "gastoId", expense.id)
            await tx.gastoCorriente.update({ where: { id: expense.id }, data: { estado: applied.gte(expense.importe) ? "PAGADO" : "AUTORIZADO" } })
          }
        }

        if (application.anticipoId) {
          const advance = await tx.anticipo.findUnique({ where: { id: application.anticipoId }, select: { id: true, importe: true, importeAplicado: true, estado: true } })
          if (advance) {
            const applied = Prisma.Decimal.max(new Prisma.Decimal(0), advance.importeAplicado.minus(application.importeAplicado))
            await tx.anticipo.update({ where: { id: advance.id }, data: { importeAplicado: applied, estado: applied.gte(advance.importe) ? "PAGADO" : "AUTORIZADO" } })
          }
        }
      }
      await auditPaymentEvent(tx, { actorId: session.user.id, accion: "PAGO_ANULADO", tipoRegistro: "Pago", registroId: id, entidad: payment.entidad, motivo: input.motivo, antes: { estado: payment.estado }, despues: { estado: "ANULADO" } })
      return tx.pago.findUnique({ where: { id } })
    })
    return NextResponse.json(updated)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
