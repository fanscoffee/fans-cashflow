import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction } from "@/lib/pagos"
import { paymentErrorResponse } from "@/lib/pagos-http"

const parameterSchema = z.discriminatedUnion("tipoRegistro", [
  z.object({ tipoRegistro: z.literal("PARAMETRO"), entidad: z.enum(["OBRADOR", "CAFETERIA"]).optional(), codigo: z.string().trim().min(2).max(80), valorDecimal: z.coerce.number().finite().optional(), valorTexto: z.string().trim().max(200).optional() }),
  z.object({ tipoRegistro: z.literal("REGLA"), entidad: z.enum(["OBRADOR", "CAFETERIA"]).optional(), importeDesde: z.coerce.number().finite().min(0), importeHasta: z.coerce.number().finite().positive().optional(), funcionRequerida: z.enum(["REGISTRAR", "SOLICITAR", "AUTORIZAR", "EJECUTAR", "CONCILIAR", "ADMINISTRAR"]) }),
])

export const GET = withAuth(async (_req, session) => {
  try {
    await requirePaymentFunction(session.user.id, "ADMINISTRAR", undefined, session.user.role)
    const [parameters, rules] = await Promise.all([
      prisma.parametroAutorizacion.findMany({ where: { activo: true }, orderBy: [{ codigo: "asc" }, { version: "desc" }] }),
      prisma.reglaAutorizacion.findMany({ where: { activo: true }, orderBy: [{ importeDesde: "asc" }, { version: "desc" }] }),
    ])
    return NextResponse.json({ parameters, rules })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    await requirePaymentFunction(session.user.id, "ADMINISTRAR", undefined, session.user.role)
    const input = parameterSchema.parse(await req.json())
    if (input.tipoRegistro === "PARAMETRO") {
      const current = await prisma.parametroAutorizacion.findFirst({ where: { codigo: input.codigo, entidad: input.entidad || null }, orderBy: { version: "desc" }, select: { version: true } })
      const created = await prisma.$transaction(async (tx) => {
        await tx.parametroAutorizacion.updateMany({ where: { codigo: input.codigo, entidad: input.entidad || null, activo: true }, data: { activo: false, vigenteHasta: new Date() } })
        const result = await tx.parametroAutorizacion.create({ data: { entidad: input.entidad || null, codigo: input.codigo, valorDecimal: input.valorDecimal ?? null, valorTexto: input.valorTexto || null, version: (current?.version || 0) + 1, changedById: session.user.id } })
        await auditPaymentEvent(tx, { actorId: session.user.id, accion: "PARAMETRO_ACTUALIZADO", tipoRegistro: "ParametroAutorizacion", registroId: result.id, entidad: input.entidad, despues: input })
        return result
      })
      return NextResponse.json(created, { status: 201 })
    }

    const created = await prisma.reglaAutorizacion.create({ data: { entidad: input.entidad || null, importeDesde: input.importeDesde, importeHasta: input.importeHasta ?? null, funcionRequerida: input.funcionRequerida, changedById: session.user.id } })
    await auditPaymentEvent(prisma, { actorId: session.user.id, accion: "REGLA_AUTORIZACION_CREADA", tipoRegistro: "ReglaAutorizacion", registroId: created.id, entidad: input.entidad, despues: input })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
