import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

export const GET = withAuth(async (req, session) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const products = await prisma.product.findMany({
    where: {
      isPurchasable: true,
      ...(search ? {
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { posDescription: { contains: search, mode: "insensitive" } },
          { fullDescription: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: { code: "asc" },
    take: 100,
    select: { id: true, code: true, posDescription: true, purchaseUnit: true, baseStockUnit: true },
  })
  return NextResponse.json({ products })
})
