import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { findPotentialProductDuplicates } from "@/lib/product-code"

export const GET = withAuth(async (req, session) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const productos = await findPotentialProductDuplicates(prisma, {
    descripcionTpv: searchParams.get("descripcionTpv"),
    descripcionCompleta: searchParams.get("descripcionCompleta"),
    codBarrasEan: searchParams.get("codBarrasEan"),
    excludeId: searchParams.get("excludeId") || undefined,
  })

  return NextResponse.json({ productos })
})
