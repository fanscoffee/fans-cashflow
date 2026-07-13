import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shiftId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { shiftId } = await params
  const shift = await checkAccess(shiftId, session.user.id, session.user.role)
  if (!shift) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  }

  try {
    const body = await request.json()
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
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ shiftId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { shiftId } = await params
  const shift = await checkAccess(shiftId, session.user.id, session.user.role)
  if (!shift) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  }

  try {
    const body = await request.json()
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
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ shiftId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { shiftId } = await params
  const shift = await checkAccess(shiftId, session.user.id, session.user.role)
  if (!shift) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  }

  try {
    const { expenseId } = await request.json()
    await prisma.expense.delete({ where: { id: expenseId } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: "Error al eliminar el gasto" },
      { status: 500 }
    )
  }
}
