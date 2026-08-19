import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const estado = searchParams.get("estado") || ""
  const categoria = searchParams.get("categoria") || ""
  const page = parseInt(searchParams.get("page") || "1", 10)
  const pageSize = parseInt(searchParams.get("pageSize") || "50", 10)

  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { razonSocial: { contains: search, mode: "insensitive" } },
      { cifNif: { contains: search, mode: "insensitive" } },
      { contactoNombre: { contains: search, mode: "insensitive" } },
    ]
  }
  if (estado) where.estado = estado
  if (categoria) where.categoriaServicio = categoria

  const [proveedores, total] = await Promise.all([
    prisma.proveedor.findMany({
      where,
      orderBy: { razonSocial: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { productos: true } } },
    }),
    prisma.proveedor.count({ where }),
  ])

  return NextResponse.json({ proveedores, total, page, pageSize })
})

export const POST = withAuth(async (req, session) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const body = await req.json()

    const existing = await prisma.proveedor.findUnique({
      where: { cifNif: body.cifNif },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe un proveedor con el CIF/NIF ${body.cifNif}` },
        { status: 400 }
      )
    }

    const proveedor = await prisma.proveedor.create({
      data: {
        ...body,
        createdById: session.user.id,
      },
    })

    return NextResponse.json(proveedor, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear el proveedor"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
