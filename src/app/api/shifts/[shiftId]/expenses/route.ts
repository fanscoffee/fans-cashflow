import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { toN } from "@/lib/money"

async function checkAccess(shiftId: string, userId: string, userRole: string) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } })
  if (!shift) return null
  const isAdminOrSocio = userRole === "ADMIN" || userRole === "SOCIO"
  if (!isAdminOrSocio && shift.createdById !== userId) return null
  return shift
}

async function recalculateFondoFinal(shiftId: string) {
  const [shift, expensesAgg] = await Promise.all([
    prisma.shift.findUnique({ where: { id: shiftId }, select: { fondoInicial: true } }),
    prisma.expense.aggregate({
      _sum: { importe: true },
      where: { shiftId },
    }),
  ])
  if (!shift) return
  const totalExpenses = toN(expensesAgg._sum.importe)
  const fondoFinal = toN(shift.fondoInicial) - totalExpenses
  await prisma.shift.update({
    where: { id: shiftId },
    data: { fondoFinal },
  })
}

export const POST = withAuth(async () => {
  return NextResponse.json({ error: "Los gastos nuevos deben registrarse desde el módulo de pagos" }, { status: 410 })
})

export const PATCH = withAuth(async (req, session, context) => {
  const { shiftId } = await context.params
  const shift = await checkAccess(shiftId, session.user.id, session.user.role)
  if (!shift) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  }

  try {
    const body = await req.json()
    const data = z.object({
      expenseId: z.string(),
      proveedor: z.string().min(1).optional(),
      importe: z.number().min(0.01).optional(),
    }).parse(body)

    const expense = await prisma.expense.update({
      where: { id: data.expenseId },
      data: {
        ...(data.proveedor !== undefined && { proveedor: data.proveedor }),
        ...(data.importe !== undefined && { importe: data.importe }),
      },
    })

    await recalculateFondoFinal(shiftId)

    return NextResponse.json(expense)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Error al actualizar el gasto" },
      { status: 500 }
    )
  }
})

export const DELETE = withAuth(async (req, session, context) => {
  const { shiftId } = await context.params
  const shift = await checkAccess(shiftId, session.user.id, session.user.role)
  if (!shift) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  }

  try {
    const { expenseId } = await req.json()
    await prisma.expense.delete({ where: { id: expenseId } })
    await recalculateFondoFinal(shiftId)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: "Error al eliminar el gasto" },
      { status: 500 }
    )
  }
})
