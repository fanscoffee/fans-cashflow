import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { toN } from "@/lib/money"

const updateShiftSchema = z.object({
  efectivo: z.number().min(0).optional(),
  caixa: z.number().min(0).optional(),
  santander: z.number().min(0).optional(),
  fondoInicial: z.number().min(0).optional(),
  status: z.enum(["ABIERTO", "CERRADO"]).optional(),
})

export const PATCH = withAuth(async (req, session, context) => {
  const { shiftId } = await context.params

  const shift = await prisma.shift.findUnique({ where: { id: shiftId } })
  if (!shift) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  }

  const isAdminOrSocio = session.user.role === "ADMIN" || session.user.role === "SOCIO"
  if (!isAdminOrSocio && shift.createdById !== session.user.id) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  }

  if (!isAdminOrSocio && shift.status === "CERRADO") {
    return NextResponse.json({ error: "El turno ya está cerrado" }, { status: 400 })
  }

  const body = await req.json()
  const data = updateShiftSchema.parse(body)

  const expensesAgg = await prisma.expense.aggregate({
    _sum: { importe: true },
    where: { shiftId },
  })
  const totalExpenses = toN(expensesAgg._sum.importe)
  const newFondoInicial = data.fondoInicial !== undefined ? data.fondoInicial : toN(shift.fondoInicial)
  const fondoFinal = newFondoInicial - totalExpenses

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      ...(data.efectivo !== undefined && { efectivo: data.efectivo }),
      ...(data.caixa !== undefined && { caixa: data.caixa }),
      ...(data.santander !== undefined && { santander: data.santander }),
      ...(data.fondoInicial !== undefined && { fondoInicial: data.fondoInicial }),
      ...(data.status && { status: data.status }),
      ...(data.status === "CERRADO" && { closedAt: new Date() }),
      ...(data.status === "ABIERTO" && { closedAt: null }),
      fondoFinal,
    },
    include: { expenses: true },
  })

  return NextResponse.json(updated)
})
