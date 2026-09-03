import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { getFirstSearchParam } from "@/lib/request-params"

export const GET = withAuth(async (req) => {
  const searchParams = new URL(req.url).searchParams
  const supplierId = getFirstSearchParam(searchParams, "supplierId", "proveedorId")

  if (!supplierId) {
    return NextResponse.json({ products: [] })
  }

  const products = await prisma.product.findMany({
    where: {
      isPurchasable: true,
      status: "Activo",
      suppliers: { some: { supplierId } },
    },
    select: {
      id: true,
      code: true,
      posDescription: true,
      purchaseUnit: true,
      baseUnitCost: true,
    },
    orderBy: { code: "asc" },
  })

  return NextResponse.json({ products })
})
