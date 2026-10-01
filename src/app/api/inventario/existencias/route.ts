import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { isRole } from "@/lib/roles"
import { COFFEE_SHOP_LOCATION_CODE } from "@/lib/inventory-ledger"

export const GET = withAuth(async (_req, session) => {
  if (isRole(session.user.role, UserRole.BAKERY)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const balances = await prisma.inventoryBalance.findMany({
    where: { location: { code: COFFEE_SHOP_LOCATION_CODE } },
    include: {
      location: { select: { code: true, name: true } },
      product: { select: { code: true, posDescription: true, baseStockUnit: true, minimumStock: true } },
    },
    orderBy: { product: { code: "asc" } },
  })
  return NextResponse.json(balances)
})
