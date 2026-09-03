import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole, isRole } from "@/lib/roles"

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
