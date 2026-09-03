import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import {
  createExpenseFromShift,
  createShiftExpenseSchema,
  PaymentDomainError,
} from "@/lib/payments"
import { paymentErrorResponse } from "@/lib/payments-http"
import { CreditorStatus, CreditorType, UserRole, PaymentEntity } from "@/lib/database-enums"
import { hasAnyRole, isRole } from "@/lib/roles"

async function requireOpenShift(shiftId: string, userId: string, role: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    select: { id: true, status: true, createdById: true },
  })
  const canManageAllShifts = hasAnyRole(role, [UserRole.ADMIN, UserRole.PARTNER])
  if (!shift || (!canManageAllShifts && shift.createdById !== userId)) {
    throw new PaymentDomainError("Turno no encontrado", 404, "SHIFT_NOT_FOUND")
  }
  if (shift.status !== "ABIERTO") {
    throw new PaymentDomainError("El turno debe estar abierto para registrar el gasto", 409, "SHIFT_NOT_OPEN")
  }
  return shift
}

export const GET = withAuth(async (_req, session, context) => {
  if (isRole(session.user.role, UserRole.BAKERY)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  try {
    const { shiftId } = await context.params
    await requireOpenShift(shiftId, session.user.id, session.user.role)
    const [categories, creditors] = await Promise.all([
      prisma.expenseCategory.findMany({
        where: { active: true },
        select: { id: true, code: true, name: true },
        orderBy: { code: "asc" },
      }),
      prisma.creditor.findMany({
        where: { status: CreditorStatus.ACTIVE, NOT: { type: CreditorType.MERCHANDISE_SUPPLIER } },
        select: { id: true, code: true, name: true, type: true },
        orderBy: { name: "asc" },
      }),
    ])
    return NextResponse.json({ entity: PaymentEntity.COFFEE_SHOP, categories, creditors })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session, context) => {
  if (isRole(session.user.role, UserRole.BAKERY)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
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
