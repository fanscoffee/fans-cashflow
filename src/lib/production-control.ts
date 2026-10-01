import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import {
  InventoryTransactionType,
  OperationalRecordStatus,
  RecipeVersionStatus,
  UserRole,
} from "@/lib/database-enums"
import { hasAnyRole, isRole } from "@/lib/roles"
import {
  COFFEE_SHOP_LOCATION_CODE,
  getStockLocation,
  InventoryDomainError,
  postInventoryTransaction,
  reverseInventoryTransaction,
} from "@/lib/inventory-ledger"
import { calculateProductionConsumptions, type ActualConsumption } from "@/lib/production-calculations"

type OperationalUser = {
  id: string
  role?: string | null
}

function isManager(user: OperationalUser) {
  return hasAnyRole(user.role, [UserRole.ADMIN, UserRole.PARTNER])
}

function controlsStock(value: string) {
  return value.trim().toLocaleUpperCase("es-ES") === "SI"
}

function isActive(value: string) {
  return value.trim().toLocaleUpperCase("es-ES") === "ACTIVO"
}

async function validateOperationalContext(
  user: OperationalUser,
  shiftId: string | undefined,
  standaloneReason: string | undefined,
) {
  if (isRole(user.role, UserRole.BAKERY)) throw new InventoryDomainError("No autorizado", 403)
  if (!shiftId) {
    if (!isManager(user)) throw new InventoryDomainError("Solo un socio o administrador puede registrar fuera de turno", 403)
    if (!standaloneReason?.trim()) throw new InventoryDomainError("El motivo de carga fuera de turno es obligatorio")
    return null
  }

  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { operationalReview: { select: { id: true } } },
  })
  if (!shift) throw new InventoryDomainError("Turno no encontrado", 404)
  if (shift.status !== "ABIERTO") throw new InventoryDomainError("El turno está cerrado", 409)
  if (shift.operationalReview) {
    throw new InventoryDomainError("Las operaciones del turno ya fueron cerradas; utiliza una carga administrativa o una reversa", 409)
  }
  if (!isManager(user) && shift.createdById !== user.id) throw new InventoryDomainError("Turno no encontrado", 404)
  return shift
}

async function lockAndRevalidateShift(tx: Prisma.TransactionClient, user: OperationalUser, shiftId?: string) {
  if (!shiftId) return
  const rows = await tx.$queryRaw<Array<{ status: string; createdById: string }>>(Prisma.sql`
    SELECT "status", "createdById"
    FROM "Shift"
    WHERE "id" = ${shiftId}
    FOR UPDATE
  `)
  const shift = rows[0]
  if (!shift) throw new InventoryDomainError("Turno no encontrado", 404)
  if (shift.status !== "ABIERTO") throw new InventoryDomainError("El turno está cerrado", 409)
  if (!isManager(user) && shift.createdById !== user.id) throw new InventoryDomainError("Turno no encontrado", 404)
  const review = await tx.shiftOperationalReview.findUnique({ where: { shiftId }, select: { id: true } })
  if (review) throw new InventoryDomainError("Las operaciones del turno ya fueron cerradas; utiliza una carga administrativa o una reversa", 409)
}

export async function createProductionEntry(
  user: OperationalUser,
  input: {
    shiftId?: string
    productId: string
    quantity: number
    actualConsumptions?: ActualConsumption[]
    exceptionReason?: string
    deviationReason?: string
    standaloneReason?: string
    effectiveAt?: Date
    allowNegative?: boolean
  },
) {
  await validateOperationalContext(user, input.shiftId, input.standaloneReason)
  const manager = isManager(user)
  if (input.allowNegative && !manager) throw new InventoryDomainError("No autorizado para permitir stock negativo", 403)

  const [product, recipeVersion] = await Promise.all([
    prisma.product.findUnique({ where: { id: input.productId } }),
    prisma.recipeVersion.findFirst({
      where: {
        recipe: { productId: input.productId },
        status: RecipeVersionStatus.ACTIVE,
      },
      include: { components: { include: { componentProduct: true } } },
    }),
  ])
  if (!product || !isActive(product.status)) throw new InventoryDomainError("Producto no encontrado o inactivo", 404)
  if (!recipeVersion && !input.exceptionReason?.trim()) {
    throw new InventoryDomainError("Debes justificar la producción de un artículo sin receta")
  }
  if (recipeVersion && recipeVersion.calculatedUnitCost == null) {
    throw new InventoryDomainError("La receta activa no tiene el coste inicializado; un socio o administrador debe calcularlo antes de producir", 409)
  }

  let consumptions: ReturnType<typeof calculateProductionConsumptions> = []
  if (recipeVersion) {
    try {
      consumptions = calculateProductionConsumptions(
        input.quantity,
        Number(recipeVersion.tolerancePercentage),
        recipeVersion.components.map((component) => ({
          componentProductId: component.componentProductId,
          quantityPerUnit: Number(component.quantityPerUnit),
        })),
        input.actualConsumptions,
      )
    } catch (error) {
      throw new InventoryDomainError(error instanceof Error ? error.message : "Consumos no válidos")
    }
  } else if (input.actualConsumptions?.length) {
    throw new InventoryDomainError("No puedes indicar consumos para un artículo sin receta")
  }

  const hasDeviation = consumptions.some((item) => item.hasDeviation)
  const exceedsTolerance = consumptions.some((item) => item.exceedsTolerance)
  if (hasDeviation && !input.deviationReason?.trim()) {
    throw new InventoryDomainError("Debes justificar la diferencia entre consumo teórico y real")
  }

  const status = exceedsTolerance
    ? (manager ? OperationalRecordStatus.APPROVED : OperationalRecordStatus.REVIEW_REQUIRED)
    : OperationalRecordStatus.POSTED
  const effectiveAt = input.shiftId ? new Date() : (input.effectiveAt || new Date())

  return prisma.$transaction(async (tx) => {
    await lockAndRevalidateShift(tx, user, input.shiftId)
    const location = await getStockLocation(tx, COFFEE_SHOP_LOCATION_CODE)
    const movementInputs = [
      ...(controlsStock(product.stockControl)
        ? [{ productId: product.id, quantity: input.quantity, unitCost: product.baseUnitCost == null ? null : Number(product.baseUnitCost) }]
        : []),
      ...consumptions
        .filter((consumption) => {
          const component = recipeVersion?.components.find((item) => item.componentProductId === consumption.componentProductId)
          return component && controlsStock(component.componentProduct.stockControl)
        })
        .map((consumption) => {
          const component = recipeVersion!.components.find((item) => item.componentProductId === consumption.componentProductId)!
          return {
            productId: consumption.componentProductId,
            quantity: -consumption.actualQuantity,
            unitCost: component.unitCostSnapshot == null ? null : Number(component.unitCostSnapshot),
          }
        }),
    ]

    const inventoryTransaction = movementInputs.length > 0
      ? await postInventoryTransaction(tx, {
          type: InventoryTransactionType.PRODUCTION,
          locationId: location.id,
          effectiveAt,
          createdById: user.id,
          reason: input.exceptionReason || input.deviationReason,
          movements: movementInputs,
          allowNegative: Boolean(input.allowNegative),
        })
      : null

    return tx.productionEntry.create({
      data: {
        shiftId: input.shiftId,
        locationId: location.id,
        productId: product.id,
        recipeVersionId: recipeVersion?.id,
        quantity: input.quantity,
        exceptionReason: input.exceptionReason?.trim() || null,
        deviationReason: input.deviationReason?.trim() || null,
        standaloneReason: input.standaloneReason?.trim() || null,
        status,
        inventoryTransactionId: inventoryTransaction?.id,
        createdById: user.id,
        approvedById: status === OperationalRecordStatus.APPROVED ? user.id : null,
        approvedAt: status === OperationalRecordStatus.APPROVED ? new Date() : null,
        effectiveAt,
        consumptions: {
          create: consumptions.map((consumption) => ({
            componentProductId: consumption.componentProductId,
            theoreticalQuantity: consumption.theoreticalQuantity,
            actualQuantity: consumption.actualQuantity,
            exceedsTolerance: consumption.exceedsTolerance,
          })),
        },
      },
      include: {
        product: { select: { code: true, posDescription: true, baseStockUnit: true } },
        createdBy: { select: { name: true, email: true } },
        consumptions: { include: { componentProduct: { select: { code: true, posDescription: true, baseStockUnit: true } } } },
      },
    })
  })
}

export async function createWasteEntry(
  user: OperationalUser,
  input: {
    shiftId?: string
    productId: string
    reasonId: string
    quantity: number
    notes?: string
    standaloneReason?: string
    effectiveAt?: Date
    allowNegative?: boolean
  },
) {
  await validateOperationalContext(user, input.shiftId, input.standaloneReason)
  const manager = isManager(user)
  if (input.allowNegative && !manager) throw new InventoryDomainError("No autorizado para permitir stock negativo", 403)

  const [product, reason] = await Promise.all([
    prisma.product.findUnique({ where: { id: input.productId } }),
    prisma.wasteReason.findUnique({ where: { id: input.reasonId } }),
  ])
  if (!product || !isActive(product.status) || !controlsStock(product.stockControl)) {
    throw new InventoryDomainError("El producto no está activo o no controla stock", 404)
  }
  if (!reason?.active) throw new InventoryDomainError("Motivo de merma no disponible", 404)
  if (reason.code === "OTRO" && !input.notes?.trim()) throw new InventoryDomainError("La observación es obligatoria para el motivo OTRO")

  const effectiveAt = input.shiftId ? new Date() : (input.effectiveAt || new Date())
  return prisma.$transaction(async (tx) => {
    await lockAndRevalidateShift(tx, user, input.shiftId)
    const location = await getStockLocation(tx, COFFEE_SHOP_LOCATION_CODE)
    const inventoryTransaction = await postInventoryTransaction(tx, {
      type: InventoryTransactionType.WASTE,
      locationId: location.id,
      effectiveAt,
      createdById: user.id,
      reason: `${reason.name}${input.notes?.trim() ? `: ${input.notes.trim()}` : ""}`,
      movements: [{
        productId: product.id,
        quantity: -input.quantity,
        unitCost: product.baseUnitCost == null ? null : Number(product.baseUnitCost),
      }],
      allowNegative: Boolean(input.allowNegative),
    })

    return tx.wasteEntry.create({
      data: {
        shiftId: input.shiftId,
        locationId: location.id,
        productId: product.id,
        reasonId: reason.id,
        quantity: input.quantity,
        notes: input.notes?.trim() || null,
        standaloneReason: input.standaloneReason?.trim() || null,
        inventoryTransactionId: inventoryTransaction.id,
        createdById: user.id,
        effectiveAt,
      },
      include: {
        product: { select: { code: true, posDescription: true, baseStockUnit: true } },
        reason: true,
        createdBy: { select: { name: true, email: true } },
      },
    })
  })
}

export async function approveProductionEntry(user: OperationalUser, productionId: string) {
  if (!isManager(user)) throw new InventoryDomainError("No autorizado", 403)
  const production = await prisma.productionEntry.findUnique({ where: { id: productionId } })
  if (!production) throw new InventoryDomainError("Producción no encontrada", 404)
  if (production.status !== OperationalRecordStatus.REVIEW_REQUIRED) {
    throw new InventoryDomainError("La producción no está pendiente de revisión", 409)
  }
  return prisma.productionEntry.update({
    where: { id: productionId },
    data: { status: OperationalRecordStatus.APPROVED, approvedById: user.id, approvedAt: new Date() },
  })
}

export async function reverseProductionEntry(user: OperationalUser, productionId: string, reason: string) {
  if (!isManager(user)) throw new InventoryDomainError("No autorizado", 403)
  return prisma.$transaction(async (tx) => {
    const production = await tx.productionEntry.findUnique({ where: { id: productionId } })
    if (!production) throw new InventoryDomainError("Producción no encontrada", 404)
    if (production.status === OperationalRecordStatus.REVERSED) throw new InventoryDomainError("La producción ya fue reversada", 409)
    if (production.inventoryTransactionId) {
      await reverseInventoryTransaction(tx, { transactionId: production.inventoryTransactionId, createdById: user.id, reason })
    }
    return tx.productionEntry.update({
      where: { id: productionId },
      data: { status: OperationalRecordStatus.REVERSED, reversedById: user.id, reversedAt: new Date() },
    })
  })
}

export async function reverseWasteEntry(user: OperationalUser, wasteId: string, reason: string) {
  if (!isManager(user)) throw new InventoryDomainError("No autorizado", 403)
  return prisma.$transaction(async (tx) => {
    const waste = await tx.wasteEntry.findUnique({ where: { id: wasteId } })
    if (!waste) throw new InventoryDomainError("Merma no encontrada", 404)
    if (waste.status === OperationalRecordStatus.REVERSED) throw new InventoryDomainError("La merma ya fue reversada", 409)
    await reverseInventoryTransaction(tx, { transactionId: waste.inventoryTransactionId, createdById: user.id, reason })
    return tx.wasteEntry.update({
      where: { id: wasteId },
      data: { status: OperationalRecordStatus.REVERSED, reversedById: user.id, reversedAt: new Date() },
    })
  })
}
