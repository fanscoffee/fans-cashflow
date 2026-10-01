import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { InventoryTransactionType, UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"
import { COFFEE_SHOP_LOCATION_CODE, getStockLocation, InventoryDomainError, postInventoryTransaction } from "@/lib/inventory-ledger"

const schema = z.object({
  productId: z.string().min(1),
  targetQuantity: z.coerce.number().finite().nonnegative().max(1_000_000_000),
  reason: z.string().trim().min(3).max(1000),
}).strict()

export const POST = withAuth(async (req, session) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  try {
    const input = schema.parse(await req.json())
    const product = await prisma.product.findUnique({ where: { id: input.productId } })
    if (!product || product.status.trim().toUpperCase() !== "ACTIVO" || product.stockControl.trim().toUpperCase() !== "SI") {
      throw new InventoryDomainError("El producto no está activo o no controla stock", 404)
    }

    const result = await prisma.$transaction(async (tx) => {
      const location = await getStockLocation(tx, COFFEE_SHOP_LOCATION_CODE)
      const current = await tx.inventoryBalance.findUnique({
        where: { locationId_productId: { locationId: location.id, productId: product.id } },
      })
      const delta = Number((input.targetQuantity - Number(current?.quantity || 0)).toFixed(4))
      if (Math.abs(delta) < 0.00005) throw new InventoryDomainError("La existencia ya coincide con la cantidad indicada", 409)
      return postInventoryTransaction(tx, {
        type: current ? InventoryTransactionType.PHYSICAL_ADJUSTMENT : InventoryTransactionType.OPENING_BALANCE,
        locationId: location.id,
        effectiveAt: new Date(),
        createdById: session.user.id,
        reason: input.reason,
        movements: [{ productId: product.id, quantity: delta, unitCost: product.baseUnitCost == null ? null : Number(product.baseUnitCost) }],
      })
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    if (error instanceof InventoryDomainError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: "No se pudo ajustar la existencia" }, { status: 500 })
  }
})
