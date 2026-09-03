import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { calculateFund } from "@/lib/fund"
import { withAuth } from "@/lib/with-auth"
import { toJSON, toN } from "@/lib/money"
import { UserRole } from "@/lib/database-enums"
import { isRole } from "@/lib/roles"

export const GET = withAuth(async (_req, session) => {
  if (isRole(session.user.role, UserRole.BAKERY)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const openShift = await prisma.shift.findFirst({
    where: { status: "ABIERTO" },
  })
  if (openShift) {
    return NextResponse.json({ fund: toN(openShift.closingFund) })
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
  const fund = calculateFund(lastShift, additions)

  return NextResponse.json({ fund })
})
