import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import {
  createExpenseFromShift,
  createShiftExpenseSchema,
  PaymentDomainError,
} from "@/lib/pagos"
import { paymentErrorResponse } from "@/lib/pagos-http"

async function requireOpenShift(shiftId: string, userId: string, role: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    select: { id: true, status: true, createdById: true },
  })
  const canManageAllShifts = role === "ADMIN" || role === "SOCIO"
  if (!shift || (!canManageAllShifts && shift.createdById !== userId)) {
    throw new PaymentDomainError("Turno no encontrado", 404, "SHIFT_NOT_FOUND")
  }
  if (shift.status !== "ABIERTO") {
    throw new PaymentDomainError("El turno debe estar abierto para registrar el gasto", 409, "SHIFT_NOT_OPEN")
  }
  return shift
}

export const GET = withAuth(async (_req, session, context) => {
  try {
    const { shiftId } = await context.params
    await requireOpenShift(shiftId, session.user.id, session.user.role)
    const [categorias, acreedores] = await Promise.all([
      prisma.categoriaGasto.findMany({
        where: { activo: true },
        select: { id: true, codigo: true, nombre: true },
        orderBy: { codigo: "asc" },
      }),
      prisma.acreedor.findMany({
        where: { estado: "ACTIVO", NOT: { tipo: "PROVEEDOR_MERCANCIA" } },
        select: { id: true, codigo: true, nombre: true, tipo: true },
        orderBy: { nombre: "asc" },
      }),
    ])
    return NextResponse.json({ entidad: "CAFETERIA", categorias, acreedores })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session, context) => {
  try {
    const { shiftId } = await context.params
    const input = createShiftExpenseSchema.parse(await req.json())
    const expense = await createExpenseFromShift(
      { id: session.user.id, role: session.user.role },
      shiftId,
      input,
    )
    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
