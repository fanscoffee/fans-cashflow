import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

export const GET = withAuth(async (req, _session, context) => {
  const { id } = await context.params

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, legalName: true, taxId: true } },
      receivedBy: { select: { name: true } },
      lines: {
        include: {
          product: {
            select: {
              id: true,
              code: true,
              posDescription: true,
              purchaseUnit: true,
              itemType: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!receipt) {
    return NextResponse.json(
      { error: "Recepción no encontrada" },
      { status: 404 }
    )
  }

  return NextResponse.json(receipt)
})

export const DELETE = withAuth(async (req, session, context) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const existing = await prisma.receipt.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: "Recepción no encontrada" },
        { status: 404 }
      )
    }

    await prisma.receipt.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al eliminar recepción"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
