import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

const physicalInventorySchema = z.object({
  notas: z.string().trim().max(1000).nullable().optional(),
  lineas: z.array(z.object({
    productoId: z.string().min(1),
    cantidadUm1: z.coerce.number().finite().nonnegative().max(1_000_000_000),
    cantidadUm2: z.coerce.number().finite().nonnegative().max(1_000_000_000),
  }).strict()).min(1).max(10_000).superRefine((lineas, context) => {
    if (new Set(lineas.map((linea) => linea.productoId)).size !== lineas.length) {
      context.addIssue({ code: "custom", message: "No puedes repetir un producto en el conteo" })
    }
  }),
}).strict()

export const GET = withAuth(async (req, session) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const requestedPage = Number(searchParams.get("page") || "1")
  const requestedPageSize = Number(searchParams.get("pageSize") || "20")
  const page = Number.isInteger(requestedPage) ? Math.max(1, requestedPage) : 1
  const pageSize = Number.isInteger(requestedPageSize) ? Math.min(100, Math.max(1, requestedPageSize)) : 20

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
    const { notas, lineas } = physicalInventorySchema.parse(await req.json())

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
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    }
    const message =
      error instanceof Error ? error.message : "Error al crear inventario"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
