import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { calculateFondo } from "@/lib/fondo"
import { withAuth } from "@/lib/with-auth"
import { toJSON } from "@/lib/money"

const shiftExpenseInclude = {
  categoria: { select: { codigo: true, nombre: true } },
  solicitante: { select: { name: true, email: true } },
} as const

const currentExpensesInclude = {
  where: { estado: { not: "ANULADO" } },
  include: shiftExpenseInclude,
  orderBy: { createdAt: "asc" },
} as const

const shiftSchema = z.object({
  date: z.string().refine((value) => Number.isFinite(new Date(value).getTime()), "Fecha no válida"),
  turno: z.enum(["mañana", "tarde"]),
})

class ShiftConflictError extends Error {}

export const GET = withAuth(async (req, session) => {
  if (session.user.role === "OBRADOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const isAdminOrSocio = session.user.role === "ADMIN" || session.user.role === "SOCIO"

  let shifts

  const orderBy = [{ date: "desc" as const }, { turno: "asc" as const }]

  if (isAdminOrSocio) {
    shifts = await prisma.shift.findMany({
      include: { expenses: true, gastosCorrientes: currentExpensesInclude, cierreTurno: true, createdBy: { select: { name: true, email: true } } },
      orderBy,
    })
  } else {
    const openShift = await prisma.shift.findFirst({
      where: { createdById: session.user.id, status: "ABIERTO" },
      include: { expenses: true, gastosCorrientes: currentExpensesInclude, cierreTurno: true, createdBy: { select: { name: true, email: true } } },
      orderBy,
    })

    const lastClosed = await prisma.shift.findFirst({
      where: { createdById: session.user.id, status: "CERRADO" },
      include: { expenses: true, gastosCorrientes: currentExpensesInclude, cierreTurno: true, createdBy: { select: { name: true, email: true } } },
      orderBy,
    })

    shifts = [openShift, lastClosed].filter(Boolean)
  }

  return NextResponse.json(shifts)
})

export const POST = withAuth(async (req, session) => {
  if (session.user.role === "OBRADOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const openShift = await prisma.shift.findFirst({
    where: { status: "ABIERTO" },
  })
  if (openShift) {
    return NextResponse.json(
      { error: "Ya hay un turno abierto. Espera a que se cierre antes de abrir uno nuevo." },
      { status: 400 }
    )
  }

  try {
    const body = await req.json()
    const data = shiftSchema.parse(body)

    const shift = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(6432101)`)

      const openShiftInsideTransaction = await tx.shift.findFirst({ where: { status: "ABIERTO" } })
      if (openShiftInsideTransaction) throw new ShiftConflictError("Ya hay un turno abierto")

      const existingShift = await tx.shift.findFirst({
        where: {
          date: new Date(data.date),
          turno: data.turno,
        },
      })
      if (existingShift) throw new ShiftConflictError(`Ya existe un turno de ${data.turno} para esta fecha.`)

      const lastShift = await tx.shift.findFirst({
        orderBy: { createdAt: "desc" },
      })

      const sinceDate = lastShift?.closedAt ?? lastShift?.createdAt ?? new Date(0)

      const additionsResult = await tx.fundAddition.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gt: sinceDate } },
      })

      const additions = [{ amount: toJSON(additionsResult._sum.amount) }]
      const fondoInicial = calculateFondo(lastShift, additions)

      return tx.shift.create({
        data: {
          date: new Date(data.date),
          turno: data.turno,
          status: "ABIERTO",
          createdById: session.user.id,
          efectivo: 0,
          caixa: 0,
          santander: 0,
          efectivoGasto: 0,
          fondoInicial,
          fondoFinal: fondoInicial,
        },
        include: { expenses: true },
      })
    })

    return NextResponse.json(shift, { status: 201 })
  } catch (error) {
    if (error instanceof ShiftConflictError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un turno abierto o un turno para esa fecha y franja" }, { status: 409 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Error al crear el turno" },
      { status: 500 }
    )
  }
})
