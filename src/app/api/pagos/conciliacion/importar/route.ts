import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requireOpenAccountingPeriod, requirePaymentFunction } from "@/lib/pagos"
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
  }).strict()).min(1).max(2_000),
}).strict()

export const POST = withAuth(async (req, session) => {
  try {
    const input = importSchema.parse(await req.json())
    const account = await prisma.cuentaFondos.findUnique({ where: { id: input.cuentaFondosId }, select: { id: true, entidad: true, estado: true } })
    if (!account || account.estado !== "ACTIVA") return NextResponse.json({ error: "Cuenta no disponible" }, { status: 409 })
    await requirePaymentFunction(session.user.id, "CONCILIAR", account.entidad, session.user.role)
    const dates = input.movimientos.map((item) => new Date(item.fechaValor)).filter((date) => Number.isFinite(date.getTime()))
    if (dates.length !== input.movimientos.length) return NextResponse.json({ error: "Hay fechas de extracto no válidas" }, { status: 400 })
    const canonicalMovements = input.movimientos
      .map((item) => ({
        fechaValor: new Date(item.fechaValor).toISOString(),
        descripcion: item.descripcion,
        referenciaExterna: item.referenciaExterna || null,
        direccion: item.direccion,
        importe: item.importe,
      }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
    const hashArchivo = createHash("sha256").update(JSON.stringify(canonicalMovements)).digest("hex")
    const existingImport = await prisma.importacionExtracto.findFirst({
      where: { cuentaFondosId: account.id, hashArchivo },
      select: { id: true },
    })
    if (existingImport) return NextResponse.json({ error: "Este extracto ya fue importado", code: "STATEMENT_ALREADY_IMPORTED" }, { status: 409 })

    const periods = new Set(dates.map((date) => `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`))
    const imported = await prisma.$transaction(async (tx) => {
      for (const period of periods) {
        const [year, month] = period.split("-").map(Number)
        await requireOpenAccountingPeriod(tx, account.entidad, new Date(Date.UTC(year, month - 1, 1)))
      }
      const created = await tx.importacionExtracto.create({
        data: {
          cuentaFondosId: account.id,
          nombreArchivo: input.nombreArchivo,
          hashArchivo,
          fechaDesde: new Date(Math.min(...dates.map((date) => date.getTime()))),
          fechaHasta: new Date(Math.max(...dates.map((date) => date.getTime()))),
          creadaPorId: session.user.id,
          movimientos: { create: input.movimientos.map((item) => ({ fechaValor: new Date(item.fechaValor), descripcion: item.descripcion, referenciaExterna: item.referenciaExterna || null, direccion: item.direccion, importe: item.importe, cuentaFondos: { connect: { id: account.id } } })) },
        },
        include: { movimientos: true },
      })
      await auditPaymentEvent(tx, { actorId: session.user.id, accion: "EXTRACTO_IMPORTADO", tipoRegistro: "ImportacionExtracto", registroId: created.id, entidad: account.entidad, despues: { movimientos: created.movimientos.length, nombreArchivo: input.nombreArchivo, hashArchivo } })
      return created
    })
    return NextResponse.json(imported, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Este extracto ya fue importado", code: "STATEMENT_ALREADY_IMPORTED" }, { status: 409 })
    }
    return paymentErrorResponse(error)
  }
})
