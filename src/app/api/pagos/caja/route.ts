import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, PaymentDomainError, requireOpenAccountingPeriod, requirePaymentFunction } from "@/lib/pagos"
import { paymentErrorResponse, parseEntity } from "@/lib/pagos-http"

const cashSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ARQUEO"),
    cuentaFondosId: z.string().min(1),
    fecha: z.string().min(1),
    custodioId: z.string().min(1),
    efectivoContado: z.coerce.number().finite().min(0),
    justificantes: z.coerce.number().finite().min(0),
    observaciones: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal("REPONER"),
    cuentaFondosId: z.string().min(1),
    arqueoId: z.string().min(1),
    importe: z.coerce.number().finite().positive(),
    importeJustificado: z.coerce.number().finite().positive(),
  }),
])

export const GET = withAuth(async (req, session) => {
  const entity = parseEntity(new URL(req.url).searchParams.get("entidad"))
  try {
    await requirePaymentFunction(session.user.id, "CONCILIAR", entity, session.user.role)
    const [accounts, counts, replenishments] = await Promise.all([
      prisma.cuentaFondos.findMany({ where: { ...(entity ? { entidad: entity } : {}), tipo: "CAJA_CHICA", estado: "ACTIVA" }, orderBy: { id: "asc" } }),
      prisma.arqueoCaja.findMany({ where: { cuentaFondos: entity ? { entidad: entity } : undefined }, include: { cuentaFondos: true, custodio: { select: { name: true, email: true } }, verificador: { select: { name: true, email: true } } }, orderBy: { fecha: "desc" }, take: 100 }),
      prisma.reposicionCaja.findMany({ where: { cuentaFondos: entity ? { entidad: entity } : undefined }, include: { cuentaFondos: true, arqueo: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    ])
    return NextResponse.json({ accounts, counts, replenishments })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    const input = cashSchema.parse(await req.json())
    const account = await prisma.cuentaFondos.findUnique({ where: { id: input.cuentaFondosId } })
    if (!account || account.tipo !== "CAJA_CHICA" || account.estado !== "ACTIVA") return NextResponse.json({ error: "La cuenta no es una caja chica activa" }, { status: 409 })
    await requirePaymentFunction(session.user.id, input.action === "ARQUEO" ? "CONCILIAR" : "EJECUTAR", account.entidad, session.user.role)

    if (input.action === "ARQUEO") {
      if (input.custodioId === session.user.id) return NextResponse.json({ error: "El verificador debe ser distinto del custodio" }, { status: 409 })
      if (account.responsableId !== input.custodioId) return NextResponse.json({ error: "El custodio no coincide con el responsable de la caja" }, { status: 409 })
      const date = new Date(input.fecha)
      if (!Number.isFinite(date.getTime())) return NextResponse.json({ error: "Fecha de arqueo no válida" }, { status: 400 })
      await requireOpenAccountingPeriod(prisma, account.entidad, date)
      const fund = Number(account.fondoFijo || 0)
      const difference = Number((input.efectivoContado + input.justificantes - fund).toFixed(2))
      const count = await prisma.arqueoCaja.create({ data: { cuentaFondosId: account.id, fecha: date, custodioId: input.custodioId, verificadorId: session.user.id, efectivoContado: input.efectivoContado, justificantes: input.justificantes, fondoFijo: fund, diferencia: difference, estado: difference === 0 ? "VALIDADO" : "INCIDENCIA", observaciones: input.observaciones || null } })
      await auditPaymentEvent(prisma, { actorId: session.user.id, accion: "ARQUEO_CAJA", tipoRegistro: "ArqueoCaja", registroId: count.id, entidad: account.entidad, despues: { diferencia: difference } })
      return NextResponse.json(count, { status: 201 })
    }

    if (Math.abs(input.importe - input.importeJustificado) > 0.009) return NextResponse.json({ error: "La reposición debe coincidir exactamente con lo justificado" }, { status: 409 })
    const count = await prisma.arqueoCaja.findUnique({ where: { id: input.arqueoId } })
    if (!count || count.cuentaFondosId !== account.id || count.estado !== "VALIDADO") return NextResponse.json({ error: "El arqueo no es válido para reponer" }, { status: 409 })
    await requireOpenAccountingPeriod(prisma, account.entidad, count.fecha)
    const replenishment = await prisma.$transaction(async (tx) => {
      const existingReplenishment = await tx.reposicionCaja.findUnique({ where: { arqueoId: input.arqueoId }, select: { id: true } })
      if (existingReplenishment) throw new PaymentDomainError("El arqueo ya tiene una reposición ejecutada", 409, "CASH_COUNT_ALREADY_REPLENISHED")
      const created = await tx.reposicionCaja.create({ data: { cuentaFondosId: account.id, arqueoId: input.arqueoId || null, importe: input.importe, importeJustificado: input.importeJustificado, estado: "EJECUTADA", creadaPorId: session.user.id, ejecutadaAt: new Date() } })
      await tx.movimientoFondos.create({ data: { cuentaFondosId: account.id, entidad: account.entidad, tipo: "REPOSICION_CAJA", importe: input.importe, descripcion: "Reposición de caja chica", origenTipo: "REPOSICION_CAJA", origenId: created.id, creadoPorId: session.user.id } })
      await tx.cuentaFondos.update({ where: { id: account.id }, data: { saldoTeorico: { increment: input.importe } } })
      await auditPaymentEvent(tx, { actorId: session.user.id, accion: "CAJA_REPUESTA", tipoRegistro: "ReposicionCaja", registroId: created.id, entidad: account.entidad, despues: { importe: input.importe } })
      return created
    })
    return NextResponse.json(replenishment, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
