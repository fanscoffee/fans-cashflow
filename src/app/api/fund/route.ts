import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { calculateFondo } from "@/lib/fondo"
import { withAuth } from "@/lib/with-auth"
import { toJSON, toN } from "@/lib/money"

export const GET = withAuth(async () => {
  const openShift = await prisma.shift.findFirst({
    where: { status: "ABIERTO" },
  })
  if (openShift) {
    return NextResponse.json({ fondo: toN(openShift.fondoFinal) })
  }

  const lastShift = await prisma.shift.findFirst({
    orderBy: { createdAt: "desc" },
  })

  const sinceDate = lastShift?.closedAt ?? lastShift?.createdAt ?? new Date(0)

  const additionsResult = await prisma.fundAddition.aggregate({
    _sum: { amount: true },
    where: { createdAt: { gt: sinceDate } },
  })

  const additions = [{ amount: toJSON(additionsResult._sum.amount) }]
  const fondo = calculateFondo(lastShift, additions)

  return NextResponse.json({ fondo })
})
