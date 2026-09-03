import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"
import { getNextProductCode, ProductCodeError } from "@/lib/product-code"
import { getFirstSearchParam } from "@/lib/request-params"

export const GET = withAuth(async (req, session) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = getFirstSearchParam(searchParams, "itemType", "tipo") || ""
  const family = getFirstSearchParam(searchParams, "family", "familia") || ""

  try {
    const code = await getNextProductCode(prisma, type, family)
    return NextResponse.json({ code })
  } catch (error) {
    if (error instanceof ProductCodeError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("Error generating product code:", { type, family, error })
    return NextResponse.json({ error: "No se pudo generar el código" }, { status: 500 })
  }
})
