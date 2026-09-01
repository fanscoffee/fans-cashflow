import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction } from "@/lib/pagos"
import { paymentErrorResponse } from "@/lib/pagos-http"

const accountSchema = z.object({
  id: z.string().trim().min(1).max(12),
  tipo: z.enum(["BANCO", "CAJA", "CAJA_CHICA", "TARJETA"]),
  entidad: z.enum(["OBRADOR", "CAFETERIA"]),
  descripcion: z.string().trim().min(2).max(60),
  ibanUltimos4: z.string().regex(/^\d{4}$/).optional(),
  responsableId: z.string().min(1),
  saldoInicial: z.coerce.number().finite().min(0).default(0),
  fondoFijo: z.coerce.number().finite().min(0).optional(),
})

export const GET = withAuth(async (req, session) => {
  try {
    const rawEntity = new URL(req.url).searchParams.get("entidad")
    const entity = rawEntity === null || rawEntity === "" ? undefined : rawEntity
    if (entity !== undefined && entity !== "OBRADOR" && entity !== "CAFETERIA") {
      return NextResponse.json({ error: "Entidad no válida" }, { status: 400 })
    }
    await requirePaymentFunction(session.user.id, "SOLICITAR", entity, session.user.role)
    const accounts = await prisma.cuentaFondos.findMany({ where: entity ? { entidad: entity } : {}, orderBy: [{ entidad: "asc" }, { id: "asc" }] })
    return NextResponse.json(accounts)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    await requirePaymentFunction(session.user.id, "ADMINISTRAR", undefined, session.user.role)
    const input = accountSchema.parse(await req.json())
    if (input.tipo === "CAJA_CHICA" && input.fondoFijo == null) return NextResponse.json({ error: "La caja chica requiere fondo fijo" }, { status: 400 })
    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.cuentaFondos.create({ data: { id: input.id, tipo: input.tipo, entidad: input.entidad, descripcion: input.descripcion, ibanUltimos4: input.ibanUltimos4 || null, responsableId: input.responsableId, saldoTeorico: input.saldoInicial, fondoFijo: input.tipo === "CAJA_CHICA" ? input.fondoFijo : null } })
      if (input.saldoInicial > 0) {
        await tx.movimientoFondos.create({ data: { cuentaFondosId: created.id, entidad: created.entidad, tipo: "ENTRADA_DOTACION", importe: input.saldoInicial, descripcion: "Saldo inicial", origenTipo: "CONFIGURACION", origenId: created.id, creadoPorId: session.user.id } })
      }
      await auditPaymentEvent(tx, { actorId: session.user.id, accion: "CUENTA_CREADA", tipoRegistro: "CuentaFondos", registroId: created.id, entidad: created.entidad, despues: { tipo: created.tipo, saldoInicial: input.saldoInicial } })
      return created
    })
    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
