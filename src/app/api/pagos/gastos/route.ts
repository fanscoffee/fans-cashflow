import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { requirePaymentFunction } from "@/lib/payments"
import { paymentErrorResponse } from "@/lib/payments-http"
import { prisma } from "@/lib/prisma"
import { CurrentExpenseStatus, PaymentFunction, UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

export const GET = withAuth(async (_req, session) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    await requirePaymentFunction(session.user.id, PaymentFunction.REQUEST, undefined, session.user.role)
    const expenses = await prisma.currentExpense.findMany({
      where: { shiftId: { not: null }, status: { not: CurrentExpenseStatus.VOID } },
      include: { category: true, creditor: { select: { id: true, code: true, name: true } }, requester: { select: { id: true, name: true, email: true } }, authorizer: { select: { id: true, name: true, email: true } }, shift: { select: { id: true, date: true, shift: true } }, applications: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    })
    return NextResponse.json(expenses)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async () => {
  return NextResponse.json({ error: "Los gastos corrientes deben registrarse desde un turno abierto" }, { status: 410 })
})
