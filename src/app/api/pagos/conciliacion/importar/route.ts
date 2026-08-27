import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction } from "@/lib/pagos"
import { paymentErrorResponse } from "@/lib/pagos-http"

const importSchema = z.object({
  cuentaFondosId: z.string().min(1),
  nombreArchivo: z.string().trim().min(1).max(200),
  movimientos: z.array(z.object({
    fechaValor: z.string().min(1),
    descripcion: z.string().trim().min(1).max(200),
    referenciaExterna: z.string().trim().max(100).optional(),
    direccion: z.enum(["ENTRADA", "SALIDA"]),
    importe: z.coerce.number().finite().positive(),
  })).min(1),
})

export const POST = withAuth(async (req, session) => {
  try {
    const input = importSchema.parse(await req.json())
    const account = await prisma.cuentaFondos.findUnique({ where: { id: input.cuentaFondosId }, select: { id: true, entidad: true, estado: true } })
    if (!account || account.estado !== "ACTIVA") return NextResponse.json({ error: "Cuenta no disponible" }, { status: 409 })
    await requirePaymentFunction(session.user.id, "CONCILIAR", account.entidad, session.user.role)
    const dates = input.movimientos.map((item) => new Date(item.fechaValor)).filter((date) => Number.isFinite(date.getTime()))
    if (dates.length !== input.movimientos.length) return NextResponse.json({ error: "Hay fechas de extracto no válidas" }, { status: 400 })
    const imported = await prisma.importacionExtracto.create({
      data: {
        cuentaFondosId: account.id,
        nombreArchivo: input.nombreArchivo,
        fechaDesde: new Date(Math.min(...dates.map((date) => date.getTime()))),
        fechaHasta: new Date(Math.max(...dates.map((date) => date.getTime()))),
        creadaPorId: session.user.id,
        movimientos: { create: input.movimientos.map((item) => ({ fechaValor: new Date(item.fechaValor), descripcion: item.descripcion, referenciaExterna: item.referenciaExterna || null, direccion: item.direccion, importe: item.importe, cuentaFondos: { connect: { id: account.id } } })) },
      },
      include: { movimientos: true },
    })
    await auditPaymentEvent(prisma, { actorId: session.user.id, accion: "EXTRACTO_IMPORTADO", tipoRegistro: "ImportacionExtracto", registroId: imported.id, entidad: account.entidad, despues: { movimientos: imported.movimientos.length, nombreArchivo: input.nombreArchivo } })
    return NextResponse.json(imported, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
