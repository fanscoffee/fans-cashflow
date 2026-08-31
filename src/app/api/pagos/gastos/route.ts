import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { requirePaymentFunction } from "@/lib/pagos"
import { paymentErrorResponse } from "@/lib/pagos-http"
import { prisma } from "@/lib/prisma"

export const GET = withAuth(async (_req, session) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    await requirePaymentFunction(session.user.id, "SOLICITAR", undefined, session.user.role)
    const gastos = await prisma.gastoCorriente.findMany({
      where: { shiftId: { not: null }, estado: { not: "ANULADO" } },
      include: { categoria: true, acreedor: { select: { id: true, codigo: true, nombre: true } }, solicitante: { select: { id: true, name: true, email: true } }, autorizador: { select: { id: true, name: true, email: true } }, shift: { select: { id: true, date: true, turno: true } }, aplicaciones: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    })
    return NextResponse.json(gastos)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async () => {
  return NextResponse.json({ error: "Los gastos corrientes deben registrarse desde un turno abierto" }, { status: 410 })
})
