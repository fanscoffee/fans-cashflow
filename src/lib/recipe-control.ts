import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { RecipeVersionStatus, UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"
import { InventoryDomainError } from "@/lib/inventory-ledger"
import { calculateProductPricing } from "@/lib/product-pricing"
import { calculateRecipeUnitCost } from "@/lib/recipe-costing"
import { findPotentialProductDuplicates, getNextProductCode, ProductCodeError } from "@/lib/product-code"
import { getProductTypeBehavior } from "@/lib/product-types"

type RecipeUser = { id: string; role?: string | null }

export type RecipeComponentInput = {
  componentProductId: string
  quantityPerUnit: number
}

export type RecipeOutputProductInput = {
  posDescription: string
  fullDescription: string
  eanBarcode?: string
  itemType: "PT" | "SE"
  family: string
  subfamily?: string
  section: string
  baseStockUnit: string
  salesUnit?: string
  salesToBaseFactor?: number
  presentationFormat?: string
  standardWastePercentage?: number
  vatCode: string
  salesVatPercentage?: number
  salePriceIncludingVat?: number
  valuationMethod: string
  minimumStock?: number
  maximumStock?: number
  reorderPoint?: number
  location?: string
  abcClass?: string
  batchControl: string
  shelfLifeDays?: number
  storageConditions?: string
  allergens?: string
  notes?: string
  confirmDuplicate?: boolean
}

export type RecipeEditInput = {
  posDescription: string
  fullDescription: string
  salesVatPercentage?: number
  salePriceIncludingVat?: number
  tolerancePercentage: number
  components: RecipeComponentInput[]
}

async function loadRecipeCostContext(
  tx: Prisma.TransactionClient,
  versionId: string,
  recipeId: string,
  expectedStatus: (typeof RecipeVersionStatus)[keyof typeof RecipeVersionStatus],
) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Recipe" WHERE "id" = ${recipeId} FOR UPDATE`)
  const versionProducts = await tx.recipeVersion.findUnique({
    where: { id: versionId },
    select: {
      status: true,
      calculatedUnitCost: true,
      recipe: { select: { productId: true } },
      components: { select: { componentProductId: true } },
    },
  })
  if (!versionProducts) throw new InventoryDomainError("Versión de receta no encontrada", 404)
  if (versionProducts.status !== expectedStatus) throw new InventoryDomainError("El estado de la receta cambió; vuelve a cargar la página", 409)

  const productIds = [
    versionProducts.recipe.productId,
    ...versionProducts.components.map((component) => component.componentProductId),
  ].sort()
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "Product"
    WHERE "id" IN (${Prisma.join(productIds)})
    ORDER BY "id"
    FOR UPDATE
  `)

  const context = await tx.recipeVersion.findUnique({
    where: { id: versionId },
    include: {
      recipe: {
        include: {
          product: {
            select: {
              id: true,
              isSellable: true,
              purchaseVatPercentage: true,
              salesVatPercentage: true,
              vatPercentage: true,
              pricingMethod: true,
              targetMarginPercentage: true,
              fixedRetailPriceIncludingVat: true,
              appliedRetailPriceIncludingVat: true,
            },
          },
        },
      },
      components: {
        include: {
          componentProduct: {
            select: {
              code: true,
              isPrepared: true,
              baseUnitCost: true,
              purchaseToBaseFactor: true,
            },
          },
        },
      },
    },
  })
  if (!context) throw new InventoryDomainError("Versión de receta no encontrada", 404)
  return context
}

function calculateRecipePricing(context: Awaited<ReturnType<typeof loadRecipeCostContext>>) {
  const product = context.recipe.product
  const pricingMethod = product.pricingMethod.trim().toUpperCase()
  if (product.isSellable && pricingMethod === "MARGEN" && product.targetMarginPercentage == null) {
    throw new InventoryDomainError("Indica el margen objetivo del producto antes de activar la receta")
  }
  if (product.isSellable && pricingMethod === "MARGEN" && product.salesVatPercentage == null && product.vatPercentage == null) {
    throw new InventoryDomainError("Indica el IVA de venta del producto antes de activar la receta")
  }

  let cost
  try {
    cost = calculateRecipeUnitCost(context.components.map((component) => ({
      componentProductId: component.componentProductId,
      quantityPerUnit: Number(component.quantityPerUnit),
      componentProduct: {
        code: component.componentProduct.code,
        isPrepared: component.componentProduct.isPrepared,
        baseUnitCost: component.componentProduct.baseUnitCost == null ? null : Number(component.componentProduct.baseUnitCost),
        purchaseToBaseFactor: component.componentProduct.purchaseToBaseFactor == null ? null : Number(component.componentProduct.purchaseToBaseFactor),
      },
    })))
  } catch (error) {
    throw new InventoryDomainError(error instanceof Error ? error.message : "No se pudo calcular el coste de la receta")
  }

  const pricing = calculateProductPricing({
    costSinVat: cost.calculatedUnitCost,
    purchaseCostSinVat: cost.calculatedUnitCost,
    purchaseVatPercentage: product.purchaseVatPercentage,
    salesVatPercentage: product.salesVatPercentage,
    vatPercentage: product.vatPercentage,
    pricingMethod: product.pricingMethod,
    targetMarginPercentage: product.targetMarginPercentage,
    retailPriceIncludingVat: product.fixedRetailPriceIncludingVat ?? product.appliedRetailPriceIncludingVat,
  })
  return { cost, pricing }
}

async function persistRecipeCost(
  tx: Prisma.TransactionClient,
  context: Awaited<ReturnType<typeof loadRecipeCostContext>>,
  calculated: ReturnType<typeof calculateRecipePricing>,
  calculatedAt: Date,
) {
  for (const snapshot of calculated.cost.snapshots) {
    await tx.recipeComponent.update({
      where: {
        recipeVersionId_componentProductId: {
          recipeVersionId: context.id,
          componentProductId: snapshot.componentProductId,
        },
      },
      data: { unitCostSnapshot: snapshot.unitCostSnapshot },
    })
  }

  await tx.product.update({
    where: { id: context.recipe.product.id },
    data: {
      hasRecipe: true,
      baseUnitCost: calculated.cost.calculatedUnitCost,
      costIncludingVat: calculated.pricing.costIncludingVat,
      targetRetailPriceIncludingVat: calculated.pricing.targetRetailPriceIncludingVat,
      fixedRetailPriceIncludingVat: calculated.pricing.fixedRetailPriceIncludingVat,
      appliedRetailPriceIncludingVat: calculated.pricing.appliedRetailPriceIncludingVat,
      appliedRetailPriceExcludingVat: calculated.pricing.retailPriceExcludingVat,
      profitPerUnit: calculated.pricing.profitPerUnit,
      actualMarginPercentage: calculated.pricing.actualMarginPercentage,
      percentagePointDeviation: calculated.pricing.percentagePointDeviation,
      unitDifference: calculated.pricing.unitDifference,
      pricingDiagnosis: calculated.pricing.pricingDiagnosis,
    },
  })

  return { calculatedUnitCost: calculated.cost.calculatedUnitCost, costCalculatedAt: calculatedAt }
}

function canManageRecipes(user: RecipeUser) {
  return hasAnyRole(user.role, [UserRole.ADMIN, UserRole.PARTNER])
}

function normalized(value: string) {
  return value.trim().toLocaleUpperCase("es-ES")
}

function recipePricingMethod(isSellable: boolean, salePriceIncludingVat?: number) {
  return isSellable || (salePriceIncludingVat != null && salePriceIncludingVat > 0) ? "FIJO" : "MARGEN"
}

async function validateNewRecipeComponents(components: RecipeComponentInput[]) {
  if (components.length === 0) throw new InventoryDomainError("La receta debe incluir al menos un componente")
  if (new Set(components.map((component) => component.componentProductId)).size !== components.length) {
    throw new InventoryDomainError("No puedes repetir un componente")
  }
  const products = await prisma.product.findMany({
    where: { id: { in: components.map((component) => component.componentProductId) } },
    select: { id: true, status: true, stockControl: true },
  })
  if (products.length !== components.length || products.some((product) => normalized(product.status) !== "ACTIVO" || normalized(product.stockControl) !== "SI")) {
    throw new InventoryDomainError("Todos los componentes deben estar activos y controlar stock")
  }
}

async function validateRecipeComponents(productId: string, components: RecipeComponentInput[]) {
  if (components.length === 0) throw new InventoryDomainError("La receta debe incluir al menos un componente")
  if (new Set(components.map((component) => component.componentProductId)).size !== components.length) {
    throw new InventoryDomainError("No puedes repetir un componente")
  }
  if (components.some((component) => component.componentProductId === productId)) {
    throw new InventoryDomainError("Un producto no puede contenerse a sí mismo")
  }

  const products = await prisma.product.findMany({
    where: { id: { in: [productId, ...components.map((component) => component.componentProductId)] } },
    select: { id: true, status: true, stockControl: true },
  })
  const output = products.find((product) => product.id === productId)
  if (!output || normalized(output.status) !== "ACTIVO") throw new InventoryDomainError("Producto elaborado no encontrado o inactivo", 404)
  const byId = new Map(products.map((product) => [product.id, product]))
  for (const component of components) {
    const product = byId.get(component.componentProductId)
    if (!product || normalized(product.status) !== "ACTIVO" || normalized(product.stockControl) !== "SI") {
      throw new InventoryDomainError("Todos los componentes deben estar activos y controlar stock")
    }
  }

  const activeVersions = await prisma.recipeVersion.findMany({
    where: { status: RecipeVersionStatus.ACTIVE },
    select: {
      recipe: { select: { productId: true } },
      components: { select: { componentProductId: true } },
    },
  })
  const graph = new Map<string, string[]>()
  for (const version of activeVersions) {
    if (version.recipe.productId !== productId) {
      graph.set(version.recipe.productId, version.components.map((component) => component.componentProductId))
    }
  }
  graph.set(productId, components.map((component) => component.componentProductId))

  const visiting = new Set<string>()
  const visited = new Set<string>()
  function visit(node: string): boolean {
    if (visiting.has(node)) return true
    if (visited.has(node)) return false
    visiting.add(node)
    for (const child of graph.get(node) || []) {
      if (visit(child)) return true
    }
    visiting.delete(node)
    visited.add(node)
    return false
  }
  if (visit(productId)) throw new InventoryDomainError("La receta generaría una referencia circular")
}

export async function createRecipeVersion(
  user: RecipeUser,
  input: { productId: string; tolerancePercentage: number; components: RecipeComponentInput[] },
) {
  if (!canManageRecipes(user)) throw new InventoryDomainError("No autorizado", 403)
  await validateRecipeComponents(input.productId, input.components)

  return prisma.$transaction(async (tx) => {
    const recipe = await tx.recipe.upsert({
      where: { productId: input.productId },
      create: { productId: input.productId },
      update: {},
      include: { versions: { orderBy: { version: "desc" }, take: 1, select: { version: true } } },
    })
    const version = (recipe.versions[0]?.version || 0) + 1
    return tx.recipeVersion.create({
      data: {
        recipeId: recipe.id,
        version,
        tolerancePercentage: input.tolerancePercentage,
        createdById: user.id,
        components: { create: input.components },
      },
      include: {
        recipe: { include: { product: true } },
        components: { include: { componentProduct: true } },
      },
    })
  })
}

export async function createRecipeWithProduct(
  user: RecipeUser,
  input: {
    product: RecipeOutputProductInput
    tolerancePercentage: number
    components: RecipeComponentInput[]
    activate?: boolean
  },
) {
  if (!canManageRecipes(user)) throw new InventoryDomainError("No autorizado", 403)
  const behavior = getProductTypeBehavior(input.product.itemType)
  if (!behavior?.isPrepared) throw new InventoryDomainError("Una receta solo puede crear productos PT o SE")
  if (behavior.isSellable && !(input.product.salePriceIncludingVat && input.product.salePriceIncludingVat > 0)) {
    throw new InventoryDomainError("El precio de venta con IVA es obligatorio para productos vendibles")
  }
  if (behavior.isSellable && input.product.salesVatPercentage == null) {
    throw new InventoryDomainError("El IVA de venta es obligatorio para productos vendibles")
  }
  await validateNewRecipeComponents(input.components)

  const duplicates = await findPotentialProductDuplicates(prisma, input.product)
  if (duplicates.length > 0 && !input.product.confirmDuplicate) {
    throw new InventoryDomainError(
      `Posible producto duplicado: ${duplicates.map((product) => `${product.code} · ${product.posDescription}`).join(", ")}. Confirma que es distinto para continuar.`,
      409,
    )
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const code = await getNextProductCode(tx, input.product.itemType, input.product.family)
        const product = await tx.product.create({
          data: {
            code,
            eanBarcode: input.product.eanBarcode?.trim() || null,
            posDescription: input.product.posDescription,
            fullDescription: input.product.fullDescription,
            itemType: input.product.itemType,
            family: input.product.family,
            subfamily: input.product.subfamily?.trim() || null,
            section: input.product.section,
            isPurchasable: false,
            isPrepared: true,
            isSellable: behavior.isSellable,
            hasRecipe: false,
            baseStockUnit: input.product.baseStockUnit,
            purchaseUnit: null,
            purchaseToBaseFactor: null,
            salesUnit: input.product.salesUnit?.trim() || input.product.baseStockUnit,
            salesToBaseFactor: input.product.salesToBaseFactor ?? 1,
            netWeightPerUnitGrams: null,
            presentationFormat: input.product.presentationFormat?.trim() || null,
            baseUnitCost: null,
            costIncludingVat: null,
            standardWastePercentage: input.product.standardWastePercentage ?? null,
            vatCode: input.product.vatCode,
            vatPercentage: input.product.salesVatPercentage ?? null,
            purchaseVatPercentage: null,
            salesVatPercentage: input.product.salesVatPercentage ?? null,
             pricingMethod: recipePricingMethod(behavior.isSellable, input.product.salePriceIncludingVat),
            targetMarginPercentage: null,
            targetRetailPriceIncludingVat: null,
            fixedRetailPriceIncludingVat: input.product.salePriceIncludingVat ?? null,
            appliedRetailPriceIncludingVat: input.product.salePriceIncludingVat ?? null,
            appliedRetailPriceExcludingVat: null,
            profitPerUnit: null,
            actualMarginPercentage: null,
            percentagePointDeviation: null,
            unitDifference: null,
            pricingDiagnosis: "FALTAN DATOS",
            stockControl: "SI",
            valuationMethod: input.product.valuationMethod,
            minimumStock: input.product.minimumStock ?? null,
            maximumStock: input.product.maximumStock ?? null,
            reorderPoint: input.product.reorderPoint ?? null,
            location: input.product.location?.trim() || null,
            abcClass: input.product.abcClass?.trim() || null,
            batchControl: input.product.batchControl,
            shelfLifeDays: input.product.shelfLifeDays ?? null,
            storageConditions: input.product.storageConditions?.trim() || null,
            allergens: input.product.allergens?.trim() || null,
            status: "Activo",
            notes: input.product.notes?.trim() || null,
            createdById: user.id,
          },
        })
        const version = await tx.recipeVersion.create({
          data: {
            recipe: { create: { productId: product.id } },
            version: 1,
            tolerancePercentage: input.tolerancePercentage,
            createdBy: { connect: { id: user.id } },
            components: { create: input.components },
          },
          include: {
            recipe: { include: { product: true } },
            components: { include: { componentProduct: true } },
          },
        })
        if (!input.activate) return version

        const now = new Date()
        const context = await loadRecipeCostContext(tx, version.id, version.recipeId, RecipeVersionStatus.DRAFT)
        const calculated = calculateRecipePricing(context)
        const costData = await persistRecipeCost(tx, context, calculated, now)
        return tx.recipeVersion.update({
          where: { id: version.id },
          data: {
            status: RecipeVersionStatus.ACTIVE,
            effectiveFrom: now,
            effectiveTo: null,
            ...costData,
          },
          include: {
            recipe: { include: { product: true } },
            components: { include: { componentProduct: true } },
          },
        })
      })
    } catch (error) {
      if (error instanceof ProductCodeError) throw new InventoryDomainError(error.message, error.status)
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error
      if (attempt === 2) throw new InventoryDomainError("Ya existe un producto con el mismo código o EAN", 409)
    }
  }
  throw new InventoryDomainError("No se pudo reservar un código para el producto", 409)
}

export async function updateRecipe(
  user: RecipeUser,
  recipeId: string,
  input: RecipeEditInput,
) {
  if (!canManageRecipes(user)) throw new InventoryDomainError("No autorizado", 403)
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      product: { select: { id: true, isSellable: true } },
      versions: { orderBy: { version: "desc" }, select: { id: true, version: true, status: true } },
    },
  })
  if (!recipe || recipe.deletedAt) throw new InventoryDomainError("Receta no encontrada", 404)
  if (recipe.product.isSellable && !(input.salePriceIncludingVat && input.salePriceIncludingVat > 0)) {
    throw new InventoryDomainError("El precio de venta con IVA es obligatorio para productos vendibles")
  }
  await validateRecipeComponents(recipe.product.id, input.components)

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Recipe" WHERE "id" = ${recipeId} FOR UPDATE`)
    const current = recipe.versions.find((version) => version.status === RecipeVersionStatus.ACTIVE) || recipe.versions[0]
    if (!current) throw new InventoryDomainError("Receta sin contenido", 409)
    const productionCount = await tx.productionEntry.count({ where: { recipeVersionId: current.id } })
    const now = new Date()

    await tx.product.update({
      where: { id: recipe.product.id },
      data: {
        posDescription: input.posDescription,
        fullDescription: input.fullDescription,
        salesVatPercentage: input.salesVatPercentage ?? null,
        vatPercentage: input.salesVatPercentage ?? null,
        pricingMethod: recipePricingMethod(recipe.product.isSellable, input.salePriceIncludingVat),
        targetMarginPercentage: null,
        fixedRetailPriceIncludingVat: input.salePriceIncludingVat ?? null,
        appliedRetailPriceIncludingVat: input.salePriceIncludingVat ?? null,
        hasRecipe: true,
      },
    })

    let versionId = current.id
    const versionStatus: (typeof RecipeVersionStatus)[keyof typeof RecipeVersionStatus] = RecipeVersionStatus.ACTIVE
    if (productionCount > 0) {
      await tx.recipeVersion.update({
        where: { id: current.id },
        data: { status: RecipeVersionStatus.SUPERSEDED, effectiveTo: now },
      })
      const next = await tx.recipeVersion.create({
        data: {
          recipeId,
          version: (recipe.versions[0]?.version || 0) + 1,
          status: RecipeVersionStatus.ACTIVE,
          effectiveFrom: now,
          tolerancePercentage: input.tolerancePercentage,
          createdById: user.id,
          components: { create: input.components },
        },
      })
      versionId = next.id
    } else {
      await tx.recipeComponent.deleteMany({ where: { recipeVersionId: current.id } })
      await tx.recipeVersion.update({
        where: { id: current.id },
        data: {
          status: RecipeVersionStatus.ACTIVE,
          tolerancePercentage: input.tolerancePercentage,
          effectiveFrom: current.status === RecipeVersionStatus.ACTIVE ? undefined : now,
          effectiveTo: null,
          calculatedUnitCost: null,
          costCalculatedAt: null,
          components: { create: input.components },
        },
      })
    }

    const context = await loadRecipeCostContext(tx, versionId, recipeId, versionStatus)
    const calculated = calculateRecipePricing(context)
    const costData = await persistRecipeCost(tx, context, calculated, now)
    return tx.recipeVersion.update({
      where: { id: versionId },
      data: costData,
      include: {
        recipe: { include: { product: true } },
        components: { include: { componentProduct: true } },
      },
    })
  })
}

export async function deleteRecipe(user: RecipeUser, recipeId: string) {
  if (!canManageRecipes(user)) throw new InventoryDomainError("No autorizado", 403)
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      product: { select: { id: true } },
      versions: { select: { id: true } },
    },
  })
  if (!recipe || recipe.deletedAt) throw new InventoryDomainError("Receta no encontrada", 404)

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Recipe" WHERE "id" = ${recipeId} FOR UPDATE`)
    const productionCount = await tx.productionEntry.count({ where: { recipeVersionId: { in: recipe.versions.map((version) => version.id) } } })
    await tx.product.update({ where: { id: recipe.product.id }, data: { hasRecipe: false } })

    if (productionCount > 0) {
      await tx.recipeVersion.updateMany({
        where: { recipeId },
        data: { status: RecipeVersionStatus.SUPERSEDED, effectiveTo: new Date() },
      })
      await tx.recipe.update({ where: { id: recipeId }, data: { deletedAt: new Date() } })
      return { deleted: true, preservedHistory: true }
    }

    await tx.recipeVersion.deleteMany({ where: { recipeId } })
    await tx.recipe.delete({ where: { id: recipeId } })
    return { deleted: true, preservedHistory: false }
  })
}

export async function updateRecipeVersion(
  user: RecipeUser,
  versionId: string,
  input: { tolerancePercentage: number; components: RecipeComponentInput[] },
) {
  if (!canManageRecipes(user)) throw new InventoryDomainError("No autorizado", 403)
  const version = await prisma.recipeVersion.findUnique({
    where: { id: versionId },
    include: { recipe: true },
  })
  if (!version) throw new InventoryDomainError("Versión de receta no encontrada", 404)
  if (version.status !== RecipeVersionStatus.DRAFT) throw new InventoryDomainError("Solo se pueden editar recetas en borrador", 409)
  await validateRecipeComponents(version.recipe.productId, input.components)

  return prisma.$transaction(async (tx) => {
    await tx.recipeComponent.deleteMany({ where: { recipeVersionId: versionId } })
    return tx.recipeVersion.update({
      where: { id: versionId },
      data: {
        tolerancePercentage: input.tolerancePercentage,
        components: { create: input.components },
      },
      include: {
        recipe: { include: { product: true } },
        components: { include: { componentProduct: true } },
      },
    })
  })
}

export async function activateRecipeVersion(user: RecipeUser, versionId: string) {
  if (!canManageRecipes(user)) throw new InventoryDomainError("No autorizado", 403)
  const target = await prisma.recipeVersion.findUnique({
    where: { id: versionId },
    include: { recipe: true, components: true },
  })
  if (!target) throw new InventoryDomainError("Versión de receta no encontrada", 404)
  if (target.status !== RecipeVersionStatus.DRAFT) throw new InventoryDomainError("Solo se puede activar una receta en borrador", 409)
  if (target.components.length === 0) throw new InventoryDomainError("La receta no tiene componentes")
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const context = await loadRecipeCostContext(tx, versionId, target.recipeId, RecipeVersionStatus.DRAFT)
    const calculated = calculateRecipePricing(context)
    await tx.recipeVersion.updateMany({
      where: { recipeId: target.recipeId, status: RecipeVersionStatus.ACTIVE },
      data: { status: RecipeVersionStatus.SUPERSEDED, effectiveTo: now },
    })
    const costData = await persistRecipeCost(tx, context, calculated, now)
    const activated = await tx.recipeVersion.update({
      where: { id: versionId },
      data: {
        status: RecipeVersionStatus.ACTIVE,
        effectiveFrom: now,
        effectiveTo: null,
        ...costData,
      },
      include: {
        recipe: { include: { product: true } },
        components: { include: { componentProduct: true } },
      },
    })
    return activated
  })
}

export async function initializeActiveRecipeCost(user: RecipeUser, versionId: string) {
  if (!canManageRecipes(user)) throw new InventoryDomainError("No autorizado", 403)
  const target = await prisma.recipeVersion.findUnique({
    where: { id: versionId },
    include: { recipe: true },
  })
  if (!target) throw new InventoryDomainError("Versión de receta no encontrada", 404)
  if (target.status !== RecipeVersionStatus.ACTIVE) throw new InventoryDomainError("Solo se puede inicializar el coste de la receta vigente", 409)
  if (target.calculatedUnitCost != null) throw new InventoryDomainError("El coste de esta versión ya está congelado", 409)
  const productions = await prisma.productionEntry.count({ where: { recipeVersionId: versionId } })
  if (productions > 0) {
    throw new InventoryDomainError("La receta ya tiene producciones históricas; crea una nueva versión para no alterar su coste", 409)
  }
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const context = await loadRecipeCostContext(tx, versionId, target.recipeId, RecipeVersionStatus.ACTIVE)
    if (context.calculatedUnitCost != null) throw new InventoryDomainError("El coste de esta versión ya está congelado", 409)
    const productionCount = await tx.productionEntry.count({ where: { recipeVersionId: versionId } })
    if (productionCount > 0) {
      throw new InventoryDomainError("La receta ya tiene producciones históricas; crea una nueva versión para no alterar su coste", 409)
    }
    const calculated = calculateRecipePricing(context)
    const costData = await persistRecipeCost(tx, context, calculated, now)
    return tx.recipeVersion.update({
      where: { id: versionId },
      data: costData,
      include: {
        recipe: { include: { product: true } },
        components: { include: { componentProduct: true } },
      },
    })
  })
}

export async function deactivateRecipeVersion(user: RecipeUser, versionId: string) {
  if (!canManageRecipes(user)) throw new InventoryDomainError("No autorizado", 403)
  const target = await prisma.recipeVersion.findUnique({
    where: { id: versionId },
    include: { recipe: true },
  })
  if (!target) throw new InventoryDomainError("Versión de receta no encontrada", 404)
  if (target.status !== RecipeVersionStatus.ACTIVE) {
    throw new InventoryDomainError("Solo se puede desactivar la receta vigente", 409)
  }
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Recipe" WHERE "id" = ${target.recipeId} FOR UPDATE`)
    const updated = await tx.recipeVersion.updateMany({
      where: { id: versionId, status: RecipeVersionStatus.ACTIVE },
      data: { status: RecipeVersionStatus.SUPERSEDED, effectiveTo: now },
    })
    if (updated.count !== 1) throw new InventoryDomainError("La receta ya no está vigente", 409)

    await tx.product.update({
      where: { id: target.recipe.productId },
      data: { hasRecipe: false },
    })
    return tx.recipeVersion.findUnique({
      where: { id: versionId },
      include: {
        recipe: { include: { product: true } },
        components: { include: { componentProduct: true } },
      },
    })
  })
}
