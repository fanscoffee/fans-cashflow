import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

const expenseSchema = z.object({
  proveedor: z.string().min(1, "El proveedor es obligatorio"),
  importe: z.number().min(0.01, "El importe debe ser mayor a 0"),
})

async function checkAccess(shiftId: string, userId: string, userRole: string) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } })
  if (!shift) return null
  const isAdminOrSocio = userRole === "ADMIN" || userRole === "SOCIO"
  if (!isAdminOrSocio && shift.createdById !== userId) return null
  return shift
}

export const POST = withAuth(async (req, session, context) => {
  const { shiftId } = await context.params
  const shift = await checkAccess(shiftId, session.user.id, session.user.role)
  if (!shift) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  }

  try {
    const body = await req.json()
    const data = expenseSchema.parse(body)

    const expense = await prisma.expense.create({
      data: {
        shiftId,
        proveedor: data.proveedor,
        importe: data.importe,
      },
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Error al crear el gasto" },
      { status: 500 }
    )
  }
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
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: "Error al eliminar el gasto" },
      { status: 500 }
    )
  }
})
