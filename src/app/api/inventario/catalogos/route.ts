import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get("tipo")

  const where: Record<string, unknown> = { activo: true }
  if (tipo) where.tipo = tipo

  const catalogos = await prisma.catalogo.findMany({
    where,
    orderBy: { valor: "asc" },
  })

  return NextResponse.json(catalogos)
})

export const POST = withAuth(async (req, session) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const body = await req.json()

    const existing = await prisma.catalogo.findUnique({
      where: { tipo_valor: { tipo: body.tipo, valor: body.valor } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe el valor "${body.valor}" en el catálogo "${body.tipo}"` },
        { status: 400 }
      )
    }

    const catalogo = await prisma.catalogo.create({ data: body })
    return NextResponse.json(catalogo, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear el catálogo"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
