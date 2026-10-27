import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { canAccessAccounting } from "@/lib/accounting-invoices"

export const GET = withAuth(async (request, session) => {
  if (!canAccessAccounting(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const search = new URL(request.url).searchParams.get("search")?.trim() || ""
  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { legalName: { contains: search, mode: "insensitive" } },
      { taxId: { contains: search, mode: "insensitive" } },
    ]
  }

  const suppliers = await prisma.supplier.findMany({
    where,
    select: { id: true, legalName: true, taxId: true },
    orderBy: { legalName: "asc" },
  })

  return NextResponse.json({ suppliers })
})
