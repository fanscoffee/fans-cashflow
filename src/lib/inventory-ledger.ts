import { Prisma } from "@/generated/prisma/client"
import { InventoryTransactionType } from "@/lib/database-enums"

export const COFFEE_SHOP_LOCATION_CODE = "CAFETERIA"

export class InventoryDomainError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message)
  }
}

type LedgerClient = Pick<
  Prisma.TransactionClient,
  "inventoryBalance" | "inventoryTransaction" | "stockLocation"
>

export type InventoryMovementInput = {
  productId: string
  quantity: number
  unitCost?: number | null
}

function aggregateMovements(movements: InventoryMovementInput[]) {
  const grouped = new Map<string, InventoryMovementInput>()
  for (const movement of movements) {
    if (!Number.isFinite(movement.quantity) || Math.abs(movement.quantity) < 0.00005) continue
    const current = grouped.get(movement.productId)
    grouped.set(movement.productId, {
      productId: movement.productId,
      quantity: Number(((current?.quantity || 0) + movement.quantity).toFixed(4)),
      unitCost: movement.unitCost ?? current?.unitCost ?? null,
    })
  }
  return [...grouped.values()]
    .filter((movement) => Math.abs(movement.quantity) >= 0.00005)
    .sort((left, right) => left.productId.localeCompare(right.productId))
}

export async function getStockLocation(client: LedgerClient, code = COFFEE_SHOP_LOCATION_CODE) {
  const location = await client.stockLocation.findUnique({ where: { code } })
  if (!location || !location.active) throw new InventoryDomainError("La ubicación de stock no está disponible", 409)
  return location
}

export async function postInventoryTransaction(
  tx: LedgerClient,
  input: {
    type: (typeof InventoryTransactionType)[keyof typeof InventoryTransactionType]
    locationId: string
    effectiveAt: Date
    createdById: string
    reason?: string | null
    movements: InventoryMovementInput[]
    allowNegative?: boolean
    reversalOfId?: string
  },
) {
  const movements = aggregateMovements(input.movements)
  if (movements.length === 0) throw new InventoryDomainError("La operación no contiene movimientos de stock")

  for (const movement of movements) {
    await tx.inventoryBalance.upsert({
      where: { locationId_productId: { locationId: input.locationId, productId: movement.productId } },
      create: { locationId: input.locationId, productId: movement.productId, quantity: 0 },
      update: {},
    })
  }

  for (const movement of movements) {
    if (movement.quantity < 0 && !input.allowNegative) {
      const required = Math.abs(movement.quantity)
      const updated = await tx.inventoryBalance.updateMany({
        where: {
          locationId: input.locationId,
          productId: movement.productId,
          quantity: { gte: required },
        },
        data: { quantity: { increment: movement.quantity } },
      })
      if (updated.count !== 1) {
        throw new InventoryDomainError("Stock insuficiente para completar la operación", 409)
      }
      continue
    }

    await tx.inventoryBalance.update({
      where: { locationId_productId: { locationId: input.locationId, productId: movement.productId } },
      data: { quantity: { increment: movement.quantity } },
    })
  }

  return tx.inventoryTransaction.create({
    data: {
      type: input.type,
      locationId: input.locationId,
      effectiveAt: input.effectiveAt,
      createdById: input.createdById,
      reason: input.reason?.trim() || null,
      reversalOfId: input.reversalOfId,
      movements: {
        create: movements.map((movement) => ({
          productId: movement.productId,
          quantity: movement.quantity,
          unitCost: movement.unitCost ?? null,
        })),
      },
    },
    include: { movements: true },
  })
}

export async function reverseInventoryTransaction(
  tx: LedgerClient,
  input: {
    transactionId: string
    createdById: string
    reason: string
    effectiveAt?: Date
  },
) {
  const original = await tx.inventoryTransaction.findUnique({
    where: { id: input.transactionId },
    include: { movements: true, reversal: { select: { id: true } } },
  })
  if (!original) throw new InventoryDomainError("Movimiento de inventario no encontrado", 404)
  if (original.reversal) throw new InventoryDomainError("El movimiento ya fue reversado", 409)
  if (!input.reason.trim()) throw new InventoryDomainError("El motivo de reversa es obligatorio")

  return postInventoryTransaction(tx, {
    type: InventoryTransactionType.REVERSAL,
    locationId: original.locationId,
    effectiveAt: input.effectiveAt || new Date(),
    createdById: input.createdById,
    reason: input.reason,
    reversalOfId: original.id,
    allowNegative: true,
    movements: original.movements.map((movement) => ({
      productId: movement.productId,
      quantity: -Number(movement.quantity),
      unitCost: movement.unitCost == null ? null : Number(movement.unitCost),
    })),
  })
}
