import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { getNextProductCode, ProductCodeError } from "@/lib/product-code"

export const GET = withAuth(async (req, session) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get("tipo") || ""
  const familia = searchParams.get("familia") || ""

  try {
    const codigo = await getNextProductCode(prisma, tipo, familia)
    return NextResponse.json({ codigo })
  } catch (error) {
    if (error instanceof ProductCodeError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("Error generando código de producto:", { tipo, familia, error })
    return NextResponse.json({ error: "No se pudo generar el código" }, { status: 500 })
  }
})
