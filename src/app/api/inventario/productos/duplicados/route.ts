import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"
import { findPotentialProductDuplicates } from "@/lib/product-code"
import { getFirstSearchParam } from "@/lib/request-params"

export const GET = withAuth(async (req, session) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const products = await findPotentialProductDuplicates(prisma, {
    posDescription: getFirstSearchParam(searchParams, "posDescription", "descripcionTpv"),
    fullDescription: getFirstSearchParam(searchParams, "fullDescription", "descripcionCompleta"),
    eanBarcode: getFirstSearchParam(searchParams, "eanBarcode", "codBarrasEan"),
    excludeId: searchParams.get("excludeId") || undefined,
  })

  return NextResponse.json({ products })
})
