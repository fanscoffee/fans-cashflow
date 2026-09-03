import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

export const GET = withAuth(async (req, session, context) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const { id } = await context.params

  const inventoryActual = await prisma.physicalInventory.findUnique({
    where: { id },
    include: {
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
      },
    },
  })

  if (!inventoryActual) {
    return NextResponse.json(
      { error: "Inventario no encontrado" },
      { status: 404 }
    )
  }

  const previousInventory = await prisma.physicalInventory.findFirst({
    where: { countedAt: { lt: inventoryActual.countedAt } },
    orderBy: { countedAt: "desc" },
    include: {
      lines: {
        select: {
          productId: true,
          quantityUnit2: true,
        },
      },
    },
  })

  const previousByProduct: Record<string, number> = {}
  if (previousInventory) {
    for (const line of previousInventory.lines) {
      previousByProduct[line.productId] = Number(line.quantityUnit2)
    }
  }

  const productIds = inventoryActual.lines.map((l) => l.product.id)
  const receipts = await prisma.receiptLine.findMany({
    where: {
      productId: { in: productIds },
      receipt: {
        receivedAt: {
          gt: previousInventory?.countedAt || new Date(0),
          lte: inventoryActual.countedAt,
        },
      },
    },
    select: {
      productId: true,
      receivedQuantity: true,
      product: {
        select: {
          purchaseToBaseFactor: true,
          purchaseUnit: true,
          baseStockUnit: true,
        },
      },
    },
  })

  const receivedMap: Record<string, number> = {}
  for (const r of receipts) {
    const sameUnit = r.product.purchaseUnit === r.product.baseStockUnit
    const factor = Number(r.product.purchaseToBaseFactor) || (sameUnit ? 1 : 0)
    receivedMap[r.productId] = (receivedMap[r.productId] || 0) + Number(r.receivedQuantity) * factor
  }

  const comparison = inventoryActual.lines.map((line) => {
    const previous = previousByProduct[line.product.id] || 0
    const received = receivedMap[line.product.id] || 0
    const actual = Number(line.quantityUnit2)
    const variance = previous + received - actual

    return {
      product: line.product,
      quantityUnit1: Number(line.quantityUnit1),
      quantityUnit2: Number(line.quantityUnit2),
      baseUnit: line.product.baseStockUnit,
      previous,
      received,
      actual,
      variance,
    }
  })

  const previousInventorySummary = previousInventory
    ? {
        id: previousInventory.id,
        countedAt: previousInventory.countedAt,
      }
    : null
  const legacyComparison = comparison.map(({ previous, ...line }) => ({ ...line, anterior: previous }))

  return NextResponse.json({
    inventory: {
      id: inventoryActual.id,
      countedAt: inventoryActual.countedAt,
      notes: inventoryActual.notes,
    },
    previousInventory: previousInventorySummary,
    comparison,
    inventoryAnterior: previousInventorySummary,
    comparacion: legacyComparison,
  })
})
