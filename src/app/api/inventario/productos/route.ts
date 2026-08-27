import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const tipo = searchParams.get("tipo") || ""
  const familia = searchParams.get("familia") || ""
  const seccion = searchParams.get("seccion") || ""
  const estado = searchParams.get("estado") || ""
  const claseAbc = searchParams.get("claseAbc") || ""
  const esEjemplo = searchParams.get("esEjemplo")
  const page = parseInt(searchParams.get("page") || "1", 10)
  const pageSize = parseInt(searchParams.get("pageSize") || "50", 10)

  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { codigo: { contains: search, mode: "insensitive" } },
      { descripcionTpv: { contains: search, mode: "insensitive" } },
      { descripcionCompleta: { contains: search, mode: "insensitive" } },
    ]
  }
  if (tipo) where.tipoArticulo = tipo
  if (familia) where.familia = familia
  if (seccion) where.seccion = seccion
  if (estado) where.estado = estado
  if (claseAbc) where.claseAbc = claseAbc
  if (esEjemplo !== null) where.esEjemplo = esEjemplo === "true"

  const [productos, total] = await Promise.all([
    prisma.producto.findMany({
      where,
      orderBy: { codigo: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        proveedores: {
          where: { esPrincipal: true },
          include: { proveedor: { select: { id: true, razonSocial: true } } },
          take: 1,
        },
      },
    }),
    prisma.producto.count({ where }),
  ])

  return NextResponse.json({ productos, total, page, pageSize })
})

export const POST = withAuth(async (req, session) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const body = await req.json()

    const existing = await prisma.producto.findUnique({
      where: { codigo: body.codigo },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe un producto con el código ${body.codigo}` },
        { status: 400 }
      )
    }

    const producto = await prisma.producto.create({
      data: {
        ...body,
        createdById: session.user.id,
      },
    })

    return NextResponse.json(producto, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear el producto"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
