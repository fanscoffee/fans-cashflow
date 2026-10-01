import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"
import { receptionSchema } from "@/lib/reception-input"

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

export const PATCH = withAuth(async (req, session, context) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const input = receptionSchema.parse(await req.json())
    const existing = await prisma.receipt.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: "Recepción no encontrada" }, { status: 404 })

    const duplicate = await prisma.receipt.findFirst({
      where: {
        deliveryNoteCode: input.deliveryNoteCode,
        supplierId: input.supplierId,
        id: { not: id },
      },
      select: { id: true },
    })
    if (duplicate) {
      return NextResponse.json({ error: "Ya existe una recepción con este código de albarán para este proveedor" }, { status: 400 })
    }

    const productIds = input.lines.map((line) => line.productId)
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isPurchasable: true,
        suppliers: { some: { supplierId: input.supplierId } },
      },
      select: { id: true },
    })
    const validIds = new Set(products.map((product) => product.id))
    const invalidIds = productIds.filter((productId) => !validIds.has(productId))
    if (invalidIds.length > 0) {
      return NextResponse.json({ error: `Productos no válidos, no comprables o no asociados al proveedor: ${invalidIds.join(", ")}` }, { status: 400 })
    }

    const receipt = await prisma.$transaction((tx) => tx.receipt.update({
      where: { id },
      data: {
        deliveryNoteCode: input.deliveryNoteCode,
        supplierId: input.supplierId,
        receivedAt: new Date(input.receivedAt),
        notes: input.notes || null,
        lines: {
          deleteMany: {},
          create: input.lines.map((line) => ({
            productId: line.productId,
            receivedQuantity: line.receivedQuantity,
            unitPrice: line.unitPrice,
            batch: line.batch || null,
            dueDate: line.dueDate ? new Date(line.dueDate) : null,
          })),
        },
      },
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
    }))

    return NextResponse.json(receipt)
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    const message = error instanceof Error ? error.message : "Error al modificar recepción"
    return NextResponse.json({ error: message }, { status: 500 })
  }
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
