import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole, isRole } from "@/lib/roles"
import { physicalInventorySchema } from "@/lib/physical-inventory-input"

export const GET = withAuth(async (req, session, context) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const { id } = await context.params

  const inventory = await prisma.physicalInventory.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      lines: {
        include: {
          product: {
            select: {
              id: true,
              code: true,
              posDescription: true,
              purchaseUnit: true,
              baseStockUnit: true,
              purchaseToBaseFactor: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!inventory) {
    return NextResponse.json(
      { error: "Inventario no encontrado" },
      { status: 404 }
    )
  }

  return NextResponse.json(inventory)
})

export const PATCH = withAuth(async (req, session, context) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const { notes, lines } = physicalInventorySchema.parse(await req.json())
    const existing = await prisma.physicalInventory.findUnique({
      where: { id },
      select: { id: true, lines: { select: { productId: true } } },
    })
    if (!existing) return NextResponse.json({ error: "Inventario no encontrado" }, { status: 404 })

    const productIds = lines.map((line) => line.productId)
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        stockControl: "SI",
        status: { equals: "Activo", mode: "insensitive" },
      },
      select: { id: true },
    })
    const validIds = new Set(products.map((product) => product.id))
    const existingIds = new Set(existing.lines.map((line) => line.productId))
    const invalidIds = productIds.filter((productId) => !validIds.has(productId) && !existingIds.has(productId))
    if (invalidIds.length > 0) {
      return NextResponse.json({ error: `Productos no válidos: ${invalidIds.join(", ")}` }, { status: 400 })
    }

    const inventory = await prisma.$transaction((tx) => tx.physicalInventory.update({
      where: { id },
      data: {
        notes: notes || null,
        lines: {
          deleteMany: {},
          create: lines,
        },
      },
      include: {
        createdBy: { select: { name: true } },
        lines: {
          include: {
            product: {
              select: {
                id: true,
                code: true,
                posDescription: true,
                purchaseUnit: true,
                baseStockUnit: true,
                purchaseToBaseFactor: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }))

    return NextResponse.json(inventory)
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    const message = error instanceof Error ? error.message : "Error al modificar inventario"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

export const DELETE = withAuth(async (req, session, context) => {
  if (!isRole(session.user.role, UserRole.ADMIN)) {
    return NextResponse.json(
      { error: "Solo los administradores pueden eliminar inventarios" },
      { status: 403 }
    )
  }

  const { id } = await context.params

  try {
    const existing = await prisma.physicalInventory.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: "Inventario no encontrado" },
        { status: 404 }
      )
    }

    await prisma.physicalInventory.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al eliminar inventario"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
