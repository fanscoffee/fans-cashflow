import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") || "1")
  const pageSize = parseInt(searchParams.get("pageSize") || "20")

  const [inventarios, total] = await Promise.all([
    prisma.inventarioFisico.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { fechaConteo: "desc" },
      include: {
        creadoBy: { select: { name: true } },
        _count: { select: { lineas: true } },
      },
    }),
    prisma.inventarioFisico.count(),
  ])

  return NextResponse.json({ inventarios, total, page, pageSize })
})

export const POST = withAuth(async (req, session) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { notas, lineas } = body

    if (!lineas?.length) {
      return NextResponse.json(
        { error: "Debe incluir al menos una línea de producto" },
        { status: 400 }
      )
    }

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    const existing = await prisma.inventarioFisico.findFirst({
      where: {
        fechaConteo: {
          gte: new Date(currentYear, currentMonth, 1),
          lt: new Date(currentYear, currentMonth + 1, 1),
        },
      },
    })
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un conteo de inventario para este mes. Elimine el existente para crear uno nuevo." },
        { status: 400 }
      )
    }

    const productoIds = lineas.map((l: { productoId: string }) => l.productoId)
    const productos = await prisma.producto.findMany({
      where: { id: { in: productoIds }, esComprable: true, estado: "Activo" },
      select: { id: true },
    })
    const validIds = new Set(productos.map((p) => p.id))
    const invalidIds = productoIds.filter((id: string) => !validIds.has(id))
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Productos no válidos: ${invalidIds.join(", ")}` },
        { status: 400 }
      )
    }

    const inventario = await prisma.$transaction(async (tx) => {
      const inv = await tx.inventarioFisico.create({
        data: {
          creadoById: session.user.id,
          notas: notas || null,
          lineas: {
            create: lineas.map(
              (l: {
                productoId: string
                cantidadUm1: number
                cantidadUm2: number
              }) => ({
                productoId: l.productoId,
                cantidadUm1: l.cantidadUm1,
                cantidadUm2: l.cantidadUm2,
              })
            ),
          },
        },
        include: {
          creadoBy: { select: { name: true } },
          lineas: {
            include: {
              producto: {
                select: {
                  codigo: true,
                  descripcionTpv: true,
                  umCompra: true,
                  umBaseStock: true,
                },
              },
            },
          },
        },
      })
      return inv
    })

    return NextResponse.json(inventario, { status: 201 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al crear inventario"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
