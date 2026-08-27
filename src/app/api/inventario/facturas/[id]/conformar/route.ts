import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction } from "@/lib/pagos"
import { paymentErrorResponse } from "@/lib/pagos-http"

const conformSchema = z.object({
  entidad: z.enum(["OBRADOR", "CAFETERIA"]),
  importeConformado: z.coerce.number().finite().positive(),
  importeRetenido: z.coerce.number().finite().min(0).default(0),
  motivoRetencion: z.string().trim().max(500).optional(),
  referenciaOrigen: z.string().trim().max(120).optional(),
})

export const PATCH = withAuth(async (req, session, context) => {
  try {
    const { id } = await context.params
    const input = conformSchema.parse(await req.json())
    const invoice = await prisma.factura.findUnique({ where: { id }, include: { acreedor: true } })
    if (!invoice) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
    if (!invoice.acreedorId || !invoice.acreedor) return NextResponse.json({ error: "La factura no tiene acreedor asociado" }, { status: 409 })
    await requirePaymentFunction(session.user.id, "AUTORIZAR", input.entidad, session.user.role)
    const attachment = await prisma.adjuntoPago.findFirst({ where: { facturaId: id }, select: { id: true } })
    if (!attachment) return NextResponse.json({ error: "La factura necesita un adjunto antes de conformarse" }, { status: 409 })
    if (input.importeConformado + input.importeRetenido > Number(invoice.importeTotal)) return NextResponse.json({ error: "El importe conformado y retenido supera el total de la factura" }, { status: 409 })
    if (invoice.estadoCircuito === "ANULADA") return NextResponse.json({ error: "La factura está anulada" }, { status: 409 })

    const status = input.importeRetenido > 0 ? "PARCIALMENTE_CONFORMADA" : "CONFORMADA"
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.factura.update({ where: { id }, data: { entidad: input.entidad, estadoCircuito: status, importeConformado: input.importeConformado, importeRetenido: input.importeRetenido, motivoRetencion: input.motivoRetencion || null, referenciaOrigen: input.referenciaOrigen || null } })
      await auditPaymentEvent(tx, { actorId: session.user.id, accion: "FACTURA_CONFORMADA", tipoRegistro: "Factura", registroId: id, entidad: input.entidad, despues: { estadoCircuito: status, importeConformado: input.importeConformado, importeRetenido: input.importeRetenido } })
      return result
    })
    return NextResponse.json(updated)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
