import { NextResponse } from "next/server"
import { UserRole } from "@/lib/database-enums"
import { physicalInventoryProductSelect, withSupplierNames } from "@/lib/physical-inventory-products"
import { prisma } from "@/lib/prisma"
import { hasAnyRole } from "@/lib/roles"
import { withAuth } from "@/lib/with-auth"

export const GET = withAuth(async (_req, session) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const products = await prisma.product.findMany({
    where: {
      stockControl: "SI",
      status: { equals: "Activo", mode: "insensitive" },
    },
    select: physicalInventoryProductSelect,
    orderBy: { code: "asc" },
  })

  return NextResponse.json({ products: products.map(withSupplierNames) })
})
