import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { calculateFund } from "@/lib/fund"
import { withAuth } from "@/lib/with-auth"
import { toJSON } from "@/lib/money"
import { CurrentExpenseStatus, UserRole } from "@/lib/database-enums"
import { hasAnyRole, isRole } from "@/lib/roles"

const shiftExpenseInclude = {
  category: { select: { code: true, name: true } },
  requester: { select: { name: true, email: true } },
} as const

const currentExpensesInclude = {
  where: { status: { not: CurrentExpenseStatus.VOID } },
  include: shiftExpenseInclude,
  orderBy: { createdAt: "asc" },
} satisfies Prisma.Shift$currentExpensesArgs

const shiftSchema = z.object({
  date: z.string().refine((value) => Number.isFinite(new Date(value).getTime()), "Fecha no válida"),
  shift: z.enum(["mañana", "tarde"]),
})

class ShiftConflictError extends Error {}

export const GET = withAuth(async (req, session) => {
  if (isRole(session.user.role, UserRole.BAKERY)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const isAdminOrPartner = hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])

  let shifts

  const orderBy = [{ date: "desc" as const }, { shift: "asc" as const }]

  if (isAdminOrPartner) {
    shifts = await prisma.shift.findMany({
      include: { expenses: true, currentExpenses: currentExpensesInclude, shiftClose: true, createdBy: { select: { name: true, email: true } } },
      orderBy,
    })
  } else {
    const openShift = await prisma.shift.findFirst({
      where: { createdById: session.user.id, status: "ABIERTO" },
      include: { expenses: true, currentExpenses: currentExpensesInclude, shiftClose: true, createdBy: { select: { name: true, email: true } } },
      orderBy,
    })

    const lastClosed = await prisma.shift.findFirst({
      where: { createdById: session.user.id, status: "CERRADO" },
      include: { expenses: true, currentExpenses: currentExpensesInclude, shiftClose: true, createdBy: { select: { name: true, email: true } } },
      orderBy,
    })

    shifts = [openShift, lastClosed].filter(Boolean)
  }

  return NextResponse.json(shifts)
})

export const POST = withAuth(async (req, session) => {
  if (isRole(session.user.role, UserRole.BAKERY)) {
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
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(6432101)`)

      const openShiftInsideTransaction = await tx.shift.findFirst({ where: { status: "ABIERTO" } })
      if (openShiftInsideTransaction) throw new ShiftConflictError("Ya hay un turno abierto")

      const existingShift = await tx.shift.findFirst({
        where: {
          date: new Date(data.date),
          shift: data.shift,
        },
      })
      if (existingShift) throw new ShiftConflictError(`Ya existe un turno de ${data.shift} para esta fecha.`)

      const lastShift = await tx.shift.findFirst({
        orderBy: { createdAt: "desc" },
      })

      const sinceDate = lastShift?.closedAt ?? lastShift?.createdAt ?? new Date(0)

      const additionsResult = await tx.fundAddition.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gt: sinceDate } },
      })

      const additions = [{ amount: toJSON(additionsResult._sum.amount) }]
      const openingFund = calculateFund(lastShift, additions)

      return tx.shift.create({
        data: {
          date: new Date(data.date),
          shift: data.shift,
          status: "ABIERTO",
          createdById: session.user.id,
          cash: 0,
          caixaBankAmount: 0,
          santanderAmount: 0,
          cashExpense: 0,
          openingFund,
          closingFund: openingFund,
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
