import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const GET = withAuth(async () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(23, 59, 59, 999)

  const orders = await prisma.order.findMany({
    where: { deliveryDate: { gte: today, lte: tomorrow } },
    include: { createdBy: { select: { name: true, email: true } } },
    orderBy: { deliveryDate: "asc" },
  })

  return NextResponse.json(orders)
})
