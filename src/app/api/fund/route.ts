import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const lastShift = await prisma.shift.findFirst({
    orderBy: { createdAt: "desc" },
  })

  const sinceDate = lastShift?.createdAt ?? new Date(0)

  const additionsResult = await prisma.fundAddition.aggregate({
    _sum: { amount: true },
    where: { createdAt: { gt: sinceDate } },
  })

  const totalAdditions = Number(additionsResult._sum.amount ?? 0)
  const fondo = (lastShift ? Number(lastShift.fondoFinal) : 0) + totalAdditions

  return NextResponse.json({ fondo: Math.round(fondo * 100) / 100 })
}
