import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { createExpense, createExpenseSchema, requirePaymentFunction } from "@/lib/pagos"
import { paymentErrorResponse, parseEntity } from "@/lib/pagos-http"
import { prisma } from "@/lib/prisma"

export const GET = withAuth(async (req, session) => {
  const entity = parseEntity(new URL(req.url).searchParams.get("entidad"))
  try {
    await requirePaymentFunction(session.user.id, "SOLICITAR", entity, session.user.role)
    const gastos = await prisma.gastoCorriente.findMany({
      where: { ...(entity ? { entidad: entity } : {}) },
      include: { categoria: true, acreedor: { select: { id: true, codigo: true, nombre: true } }, solicitante: { select: { id: true, name: true, email: true } }, autorizador: { select: { id: true, name: true, email: true } }, aplicaciones: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
    return NextResponse.json(gastos)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    const input = createExpenseSchema.parse(await req.json())
    const expense = await createExpense({ id: session.user.id, role: session.user.role }, input)
    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
