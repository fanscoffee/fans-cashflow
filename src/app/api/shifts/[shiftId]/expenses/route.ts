import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { recalculateShiftFundFinal } from "@/lib/shift-fund"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole, isRole } from "@/lib/roles"

async function checkAccess(shiftId: string, userId: string, userRole: string) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } })
  if (!shift) return null
  const isAdminOrPartner = hasAnyRole(userRole, [UserRole.ADMIN, UserRole.PARTNER])
  if (!isAdminOrPartner && shift.createdById !== userId) return null
  return shift
}

export const POST = withAuth(async () => {
  return NextResponse.json({ error: "Los gastos nuevos deben registrarse desde el módulo de pagos" }, { status: 410 })
})

export const PATCH = withAuth(async (req, session, context) => {
  if (isRole(session.user.role, UserRole.BAKERY)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const { shiftId } = await context.params
  const shift = await checkAccess(shiftId, session.user.id, session.user.role)
  if (!shift) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  }
  if (shift.status !== "ABIERTO") {
    return NextResponse.json({ error: "El turno ya está cerrado" }, { status: 409 })
  }

  try {
    const body = await req.json()
    const data = z.object({
      expenseId: z.string(),
      supplier: z.string().min(1).optional(),
      amount: z.number().min(0.01).optional(),
    }).parse(body)

    const existingExpense = await prisma.expense.findFirst({
      where: { id: data.expenseId, shiftId },
      select: { id: true },
    })
    if (!existingExpense) {
      return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 })
    }

    const expense = await prisma.expense.update({
      where: { id: data.expenseId },
      data: {
        ...(data.supplier !== undefined && { supplier: data.supplier }),
        ...(data.amount !== undefined && { amount: data.amount }),
      },
    })

    await recalculateShiftFundFinal(shiftId)

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
  if (isRole(session.user.role, UserRole.BAKERY)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const { shiftId } = await context.params
  const shift = await checkAccess(shiftId, session.user.id, session.user.role)
  if (!shift) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  }
  if (shift.status !== "ABIERTO") {
    return NextResponse.json({ error: "El turno ya está cerrado" }, { status: 409 })
  }

  try {
    const { expenseId } = z.object({ expenseId: z.string().min(1) }).parse(await req.json())
    const existingExpense = await prisma.expense.findFirst({
      where: { id: expenseId, shiftId },
      select: { id: true },
    })
    if (!existingExpense) return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 })
    await prisma.expense.delete({ where: { id: existingExpense.id } })
    await recalculateShiftFundFinal(shiftId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    }
    return NextResponse.json(
      { error: "Error al eliminar el gasto" },
      { status: 500 }
    )
  }
})
