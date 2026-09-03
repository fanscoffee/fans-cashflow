import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const GET = withAuth(async () => {
  const products = await prisma.product.findMany({
    where: {
      isPurchasable: true,
      status: "Activo",
    },
    select: {
      id: true,
      code: true,
      posDescription: true,
      purchaseUnit: true,
      baseStockUnit: true,
      purchaseToBaseFactor: true,
    },
    orderBy: { code: "asc" },
  })

  return NextResponse.json({ products })
})
