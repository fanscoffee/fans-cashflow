import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { createAdvance, createAdvanceSchema, requirePaymentFunction } from "@/lib/pagos"
import { paymentErrorResponse, parseEntity } from "@/lib/pagos-http"
import { prisma } from "@/lib/prisma"

export const GET = withAuth(async (req, session) => {
  try {
    const entity = parseEntity(new URL(req.url).searchParams.get("entidad"))
    await requirePaymentFunction(session.user.id, "SOLICITAR", entity, session.user.role)
    const advances = await prisma.anticipo.findMany({ where: entity ? { entidad: entity } : {}, include: { acreedor: { select: { id: true, nombre: true } }, solicitadoPor: { select: { id: true, name: true, email: true } }, autorizadoPor: { select: { id: true, name: true, email: true } }, aplicaciones: { where: { pago: { estado: { not: "ANULADO" } } } } }, orderBy: { fecha: "desc" }, take: 200 })
    return NextResponse.json(advances)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    const input = createAdvanceSchema.parse(await req.json())
    const advance = await createAdvance({ id: session.user.id, role: session.user.role }, input)
    return NextResponse.json(advance, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
