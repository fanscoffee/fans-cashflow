import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

const physicalInventorySchema = z.object({
  notes: z.string().trim().max(1000).nullable().optional(),
  lines: z.array(z.object({
    productId: z.string().min(1),
    quantityUnit1: z.coerce.number().finite().nonnegative().max(1_000_000_000),
    quantityUnit2: z.coerce.number().finite().nonnegative().max(1_000_000_000),
  }).strict()).min(1).max(10_000).superRefine((lines, context) => {
    if (new Set(lines.map((line) => line.productId)).size !== lines.length) {
      context.addIssue({ code: "custom", message: "No puedes repetir un producto en el conteo" })
    }
  }),
}).strict()

export const GET = withAuth(async (req, session) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const requestedPage = Number(searchParams.get("page") || "1")
  const requestedPageSize = Number(searchParams.get("pageSize") || "20")
  const page = Number.isInteger(requestedPage) ? Math.max(1, requestedPage) : 1
  const pageSize = Number.isInteger(requestedPageSize) ? Math.min(100, Math.max(1, requestedPageSize)) : 20

  const [inventories, total] = await Promise.all([
    prisma.physicalInventory.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { countedAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { lines: true } },
      },
    }),
    prisma.physicalInventory.count(),
  ])

  return NextResponse.json({ inventories, total, page, pageSize })
})

export const POST = withAuth(async (req, session) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const { notes, lines } = physicalInventorySchema.parse(await req.json())

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    const existing = await prisma.physicalInventory.findFirst({
      where: {
        countedAt: {
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

    const productIds = lines.map((l: { productId: string }) => l.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isPurchasable: true, status: "Activo" },
      select: { id: true },
    })
    const validIds = new Set(products.map((p) => p.id))
    const invalidIds = productIds.filter((id: string) => !validIds.has(id))
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Productos no válidos: ${invalidIds.join(", ")}` },
        { status: 400 }
      )
    }

    const inventory = await prisma.$transaction(async (tx) => {
      const inv = await tx.physicalInventory.create({
        data: {
          createdById: session.user.id,
          notes: notes || null,
          lines: {
            create: lines.map(
              (l: {
                productId: string
                quantityUnit1: number
                quantityUnit2: number
              }) => ({
                productId: l.productId,
                quantityUnit1: l.quantityUnit1,
                quantityUnit2: l.quantityUnit2,
              })
            ),
          },
        },
        include: {
          createdBy: { select: { name: true } },
          lines: {
            include: {
              product: {
                select: {
                  code: true,
                  posDescription: true,
                  purchaseUnit: true,
                  baseStockUnit: true,
                },
              },
            },
          },
        },
      })
      return inv
    })

    return NextResponse.json(inventory, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    }
    const message =
      error instanceof Error ? error.message : "Error al crear inventario"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
