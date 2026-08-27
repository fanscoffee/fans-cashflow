import { NextResponse } from "next/server"
import { Prisma } from "@/generated/prisma/client"
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
    const tipo = typeof body.tipo === "string" ? body.tipo.trim() : ""
    const valor = typeof body.valor === "string" ? body.valor.trim() : ""
    if (!tipo || !valor) {
      return NextResponse.json({ error: "Tipo y valor son obligatorios" }, { status: 400 })
    }

    const data = { ...body, tipo, valor }
    if (tipo === "FAMILIA") {
      const prefijoCodigo = typeof body.prefijoCodigo === "string"
        ? body.prefijoCodigo.trim().toUpperCase()
        : ""
      if (!/^[A-Z]{3}$/.test(prefijoCodigo)) {
        return NextResponse.json({ error: "El prefijo de familia debe tener 3 letras mayúsculas" }, { status: 400 })
      }
      data.prefijoCodigo = prefijoCodigo
    } else if (body.prefijoCodigo !== undefined) {
      return NextResponse.json({ error: "El prefijo solo aplica a familias" }, { status: 400 })
    }

    const existing = await prisma.catalogo.findUnique({
      where: { tipo_valor: { tipo, valor } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe el valor "${body.valor}" en el catálogo "${body.tipo}"` },
        { status: 400 }
      )
    }

    const catalogo = await prisma.catalogo.create({ data })
    return NextResponse.json(catalogo, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe ese prefijo de familia" }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : "Error al crear el catálogo"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
