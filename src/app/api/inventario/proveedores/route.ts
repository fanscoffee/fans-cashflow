import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { proveedorInputSchema, sanitizeProveedor } from "@/lib/proveedores"

export const GET = withAuth(async (req, session) => {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const estado = searchParams.get("estado") || ""
  const categoria = searchParams.get("categoria") || ""
  const requestedPage = Number(searchParams.get("page") || "1")
  const requestedPageSize = Number(searchParams.get("pageSize") || "50")
  const page = Number.isInteger(requestedPage) ? Math.max(1, requestedPage) : 1
  const pageSize = Number.isInteger(requestedPageSize) ? Math.min(100, Math.max(1, requestedPageSize)) : 50

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

  const includeBankDetails = session.user.role === "ADMIN" || session.user.role === "SOCIO"
  return NextResponse.json({ proveedores: proveedores.map((proveedor) => sanitizeProveedor(proveedor, includeBankDetails)), total, page, pageSize })
})

export const POST = withAuth(async (req, session) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const data = proveedorInputSchema.parse(await req.json())

    const existing = await prisma.proveedor.findUnique({
      where: { cifNif: data.cifNif },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe un proveedor con el CIF/NIF ${data.cifNif}` },
        { status: 400 }
      )
    }

    const proveedor = await prisma.proveedor.create({
      data: {
        ...data,
        createdById: session.user.id,
      },
    })

    return NextResponse.json(proveedor, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : "Error al crear el proveedor"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
