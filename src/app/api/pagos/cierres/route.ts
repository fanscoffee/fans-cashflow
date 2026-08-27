import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { getIndicators, requirePaymentFunction } from "@/lib/pagos"
import { prisma } from "@/lib/prisma"
import { paymentErrorResponse } from "@/lib/pagos-http"

const closeSchema = z.object({ entidad: z.enum(["OBRADOR", "CAFETERIA"]), anio: z.coerce.number().int().min(2020).max(2100), mes: z.coerce.number().int().min(1).max(12), observaciones: z.string().trim().max(500).optional() })

export const GET = withAuth(async (req, session) => {
  const params = new URL(req.url).searchParams
  const entidad = params.get("entidad")
  const where = entidad === "OBRADOR" || entidad === "CAFETERIA" ? { entidad: entidad as "OBRADOR" | "CAFETERIA" } : {}
  try {
    await requirePaymentFunction(session.user.id, "CONCILIAR", entidad === "OBRADOR" || entidad === "CAFETERIA" ? entidad : undefined, session.user.role)
    return NextResponse.json(await prisma.cierreMensual.findMany({ where, include: { indicadores: true, cerradoPor: { select: { name: true, email: true } } }, orderBy: [{ anio: "desc" }, { mes: "desc" }] }))
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    const input = closeSchema.parse(await req.json())
    await requirePaymentFunction(session.user.id, "CONCILIAR", input.entidad, session.user.role)
    const from = new Date(input.anio, input.mes - 1, 1)
    const to = new Date(input.anio, input.mes, 1)
    const unexplained = await prisma.movimientoExtracto.count({ where: { cuentaFondos: { entidad: input.entidad }, direccion: "SALIDA", fechaValor: { gte: from, lt: to }, estado: { not: "CONCILIADO" } } })
    if (unexplained > 0) return NextResponse.json({ error: "No se puede cerrar: hay movimientos bancarios sin conciliar", pendientes: unexplained }, { status: 409 })
    const indicators = await getIndicators(input.entidad, from, to)
    const close = await prisma.$transaction(async (tx) => {
      const created = await tx.cierreMensual.upsert({ where: { entidad_anio_mes: { entidad: input.entidad, anio: input.anio, mes: input.mes } }, create: { entidad: input.entidad, anio: input.anio, mes: input.mes, estado: "CERRADO", cerradoPorId: session.user.id, cerradoAt: new Date(), observaciones: input.observaciones || null }, update: { estado: "CERRADO", cerradoPorId: session.user.id, cerradoAt: new Date(), observaciones: input.observaciones || null } })
      await tx.indicadorCierre.deleteMany({ where: { cierreId: created.id } })
      const entries = Object.entries(indicators).map(([codigo, value]) => {
        const record = value && typeof value === "object" && "cantidad" in value ? value as { cantidad?: unknown; importe?: unknown; porcentaje?: unknown } : { importe: value }
        return { cierreId: created.id, codigo, cantidad: record.cantidad == null ? null : Number(record.cantidad), importe: record.importe == null ? null : Number(record.importe), porcentaje: record.porcentaje == null ? null : Number(record.porcentaje) }
      })
      await tx.indicadorCierre.createMany({ data: entries })
      return tx.cierreMensual.findUnique({ where: { id: created.id }, include: { indicadores: true } })
    })
    return NextResponse.json(close)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
