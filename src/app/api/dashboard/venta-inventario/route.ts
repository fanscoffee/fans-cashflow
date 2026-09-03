import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { toN } from "@/lib/money"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

function monthBounds(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  }
}

type InventoryDashboardPayload = {
  state: "OK" | "INCOMPLETE"
  period: { month: number; year: number }
  counts: {
    current: { id: string; countedAt: Date } | null
    previous: { id: string; countedAt: Date } | null
  }
  summary: {
    theoreticalSales: number
    actualSales: number
    variance: number | null
    variancePct: number | null
    shiftsWithClose: number
    shiftsWithoutClose: number
    productsValued: number
    pendingProducts: number
    inventoryAdjustments: number
  }
  warnings: string[]
}

function respond(payload: InventoryDashboardPayload) {
  return NextResponse.json({
    ...payload,
    status: payload.state === "INCOMPLETE" ? "INCOMPLETO" : payload.state,
    periodo: payload.period,
    conteos: {
      actual: payload.counts.current,
      anterior: payload.counts.previous,
    },
    resumen: {
      ...payload.summary,
      shiftsConClose: payload.summary.shiftsWithClose,
      productsValorizados: payload.summary.productsValued,
      productsPendientes: payload.summary.pendingProducts,
    },
  })
}

export const GET = withAuth(async (req, session) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const month = Number(searchParams.get("month") || now.getMonth() + 1)
  const year = Number(searchParams.get("year") || now.getFullYear())
  const { start, end } = monthBounds(year, month)

  const [currentInventory, shifts] = await Promise.all([
    prisma.physicalInventory.findFirst({
      where: { countedAt: { gte: start, lt: end } },
      orderBy: { countedAt: "desc" },
      include: {
        lines: {
          include: {
            product: {
              select: {
                id: true,
                isSellable: true,
                appliedRetailPriceExcludingVat: true,
                salesToBaseFactor: true,
                purchaseToBaseFactor: true,
                purchaseUnit: true,
                baseStockUnit: true,
                salesUnit: true,
              },
            },
          },
        },
      },
    }),
    prisma.shift.findMany({
      where: { date: { gte: start, lt: end }, status: "CERRADO" },
      select: { shiftClose: { select: { netSales: true } } },
    }),
  ])

  const actualSales = shifts.reduce((total, shift) => {
    return total + (shift.shiftClose ? toN(shift.shiftClose.netSales) : 0)
  }, 0)
  const shiftsWithClose = shifts.filter((shift) => shift.shiftClose).length
  const shiftsWithoutClose = shifts.length - shiftsWithClose

  if (!currentInventory) {
    return respond({
      state: "INCOMPLETE",
      period: { month, year },
      counts: { current: null, previous: null },
      summary: {
        theoreticalSales: 0,
        actualSales,
        variance: null,
        variancePct: null,
        shiftsWithClose,
        shiftsWithoutClose,
        productsValued: 0,
        pendingProducts: 0,
        inventoryAdjustments: 0,
      },
      warnings: ["No existe un conteo físico registrado para este mes."],
    })
  }

  const previousInventory = await prisma.physicalInventory.findFirst({
    where: { countedAt: { lt: currentInventory.countedAt } },
    orderBy: { countedAt: "desc" },
    include: {
      lines: { select: { productId: true, quantityUnit2: true } },
    },
  })

  if (!previousInventory) {
    return respond({
      state: "INCOMPLETE",
      period: { month, year },
      counts: {
        current: { id: currentInventory.id, countedAt: currentInventory.countedAt },
        previous: null,
      },
      summary: {
        theoreticalSales: 0,
        actualSales,
        variance: null,
        variancePct: null,
        shiftsWithClose,
        shiftsWithoutClose,
        productsValued: 0,
        pendingProducts: 0,
        inventoryAdjustments: 0,
      },
      warnings: ["No existe un conteo físico anterior para comparar."],
    })
  }

  const previousByProduct = new Map(
    previousInventory.lines.map((line) => [line.productId, toN(line.quantityUnit2)])
  )
  const productIds = currentInventory.lines.map((line) => line.productId)
  const receipts = await prisma.receiptLine.findMany({
    where: {
      productId: { in: productIds },
      receipt: {
        receivedAt: {
          gt: previousInventory.countedAt,
          lte: currentInventory.countedAt,
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

  const receivedByProduct = new Map<string, number>()
  const receiptConversionMissing = new Set<string>()
  for (const receipt of receipts) {
    const sameUnit = receipt.product.purchaseUnit === receipt.product.baseStockUnit
    const factor = toN(receipt.product.purchaseToBaseFactor) || (sameUnit ? 1 : 0)
    if (factor <= 0) {
      receiptConversionMissing.add(receipt.productId)
      continue
    }
    receivedByProduct.set(
      receipt.productId,
      (receivedByProduct.get(receipt.productId) || 0) + toN(receipt.receivedQuantity) * factor
    )
  }

  let theoreticalSales = 0
  let productsValued = 0
  let pendingProducts = 0
  let inventoryAdjustments = 0

  for (const line of currentInventory.lines) {
    if (!line.product.isSellable) continue

    const retailPriceSinVat = toN(line.product.appliedRetailPriceExcludingVat)
    const salesFactor = toN(line.product.salesToBaseFactor)
    const sameSaleUnit = line.product.salesUnit === line.product.baseStockUnit
    const validSalesFactor = salesFactor > 0 || sameSaleUnit
    const hasReceiptIssue = receiptConversionMissing.has(line.productId)
    if (retailPriceSinVat <= 0 || !validSalesFactor || hasReceiptIssue) {
      pendingProducts += 1
      continue
    }

    const current = toN(line.quantityUnit2)
    const previous = previousByProduct.get(line.productId) || 0
    const received = receivedByProduct.get(line.productId) || 0
    const outflowBase = previous + received - current
    if (outflowBase < 0) inventoryAdjustments += 1

    const unitsPerSale = salesFactor > 0 ? salesFactor : 1
    theoreticalSales += Math.max(0, outflowBase / unitsPerSale) * retailPriceSinVat
    productsValued += 1
  }

  const variance = actualSales - theoreticalSales
  const variancePct = theoreticalSales > 0 ? (variance / theoreticalSales) * 100 : null
  const warnings: string[] = []
  if (pendingProducts > 0) {
    warnings.push(`${pendingProducts} producto(s) vendible(s) no tienen configuración suficiente para valorarse.`)
  }
  if (inventoryAdjustments > 0) {
    warnings.push(`${inventoryAdjustments} producto(s) tienen un aumento de inventario no explicado por recepciones.`)
  }
  if (shiftsWithoutClose > 0) {
    warnings.push(`${shiftsWithoutClose} turno(s) cerrado(s) no tienen ticket confirmado y no se han incluido en la venta real.`)
  }

  return respond({
    state: "OK",
    period: { month, year },
    counts: {
      current: { id: currentInventory.id, countedAt: currentInventory.countedAt },
      previous: { id: previousInventory.id, countedAt: previousInventory.countedAt },
    },
    summary: {
      theoreticalSales,
      actualSales,
      variance,
      variancePct,
      shiftsWithClose,
      shiftsWithoutClose,
      productsValued,
      pendingProducts,
      inventoryAdjustments,
    },
    warnings,
  })
})
