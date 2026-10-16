import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { toJSON } from "@/lib/money"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

function parsePeriod(request: Request) {
  const { searchParams } = new URL(request.url)
  const now = new Date()
  const month = searchParams.has("month") ? Number(searchParams.get("month")) : now.getMonth() + 1
  const year = searchParams.has("year") ? Number(searchParams.get("year")) : now.getFullYear()

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return null
  }

  return {
    month,
    year,
    startDate: new Date(Date.UTC(year, month - 1, 1)),
    endDate: new Date(Date.UTC(year, month, 1)),
  }
}

export const GET = withAuth(async (request, session) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const period = parsePeriod(request)
  if (!period) return NextResponse.json({ error: "Periodo no válido" }, { status: 400 })

  const shifts = await prisma.shift.findMany({
    where: {
      status: "CERRADO",
      date: { gte: period.startDate, lt: period.endDate },
      shiftClose: { isNot: null },
    },
    select: {
      id: true,
      date: true,
      shiftClose: {
        select: {
          cashCloseNumber: true,
          cashSales: true,
          cardSales: true,
          breadVat4Base: true,
          breadVat4Amount: true,
          vat10Base: true,
          vat10Amount: true,
        },
      },
    },
    orderBy: [{ date: "asc" }, { shift: "asc" }],
  })

  return NextResponse.json({
    tickets: shifts.flatMap((shift) => {
      if (!shift.shiftClose) return []
      return [{
        id: shift.id,
        date: shift.date.toISOString().slice(0, 10),
        ticketNumber: shift.shiftClose.cashCloseNumber,
        cash: toJSON(shift.shiftClose.cashSales),
        card: toJSON(shift.shiftClose.cardSales),
        vat4Base: toJSON(shift.shiftClose.breadVat4Base),
        vat4: toJSON(shift.shiftClose.breadVat4Amount),
        vat10Base: toJSON(shift.shiftClose.vat10Base),
        vat10: toJSON(shift.shiftClose.vat10Amount),
      }]
    }),
  })
})
