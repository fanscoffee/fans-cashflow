import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"
import { InventoryDomainError } from "@/lib/inventory-ledger"
import { createRecipeVersion, createRecipeWithProduct } from "@/lib/recipe-control"

const optionalNumber = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) return undefined
    return typeof value === "string" ? value.trim().replace(",", ".") : value
  },
  z.coerce.number().finite().optional(),
)

const positiveQuantity = z.preprocess(
  (value) => typeof value === "string" ? value.trim().replace(",", ".") : value,
  z.coerce.number().finite().positive().max(1_000_000),
)

const componentsSchema = z.array(z.object({
  componentProductId: z.string().min(1),
  quantityPerUnit: positiveQuantity,
}).strict()).min(1).max(200)

const versionSchema = z.object({
  productId: z.string().min(1),
  tolerancePercentage: z.coerce.number().finite().min(0).max(100).default(5),
  components: componentsSchema,
}).strict()

const newRecipeSchema = z.object({
  mode: z.literal("NEW_RECIPE"),
  activate: z.boolean().optional().default(false),
  product: z.object({
    posDescription: z.string().trim().min(1).max(250),
    fullDescription: z.string().trim().min(1).max(1000),
    eanBarcode: z.string().trim().max(32).optional(),
    itemType: z.enum(["PT", "SE"]),
    family: z.string().trim().min(1).max(120),
    subfamily: z.string().trim().max(120).optional(),
    section: z.string().trim().min(1).max(120),
    baseStockUnit: z.string().trim().min(1).max(32),
    salesUnit: z.string().trim().max(32).optional(),
    salesToBaseFactor: optionalNumber.pipe(z.number().positive().max(1_000_000).optional()),
    presentationFormat: z.string().trim().max(250).optional(),
    standardWastePercentage: optionalNumber.pipe(z.number().min(0).max(100).optional()),
    vatCode: z.string().trim().min(1).max(32),
    salesVatPercentage: optionalNumber.pipe(z.number().min(0).max(100).optional()),
    salePriceIncludingVat: optionalNumber.pipe(z.number().positive().max(1_000_000_000).optional()),
    valuationMethod: z.string().trim().min(1).max(32),
    minimumStock: optionalNumber.pipe(z.number().nonnegative().max(1_000_000_000).optional()),
    maximumStock: optionalNumber.pipe(z.number().nonnegative().max(1_000_000_000).optional()),
    reorderPoint: optionalNumber.pipe(z.number().nonnegative().max(1_000_000_000).optional()),
    location: z.string().trim().max(120).optional(),
    abcClass: z.string().trim().max(32).optional(),
    batchControl: z.string().trim().min(1).max(32),
    shelfLifeDays: optionalNumber.pipe(z.number().int().nonnegative().max(100_000).optional()),
    storageConditions: z.string().trim().max(120).optional(),
    allergens: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(2000).optional(),
    confirmDuplicate: z.boolean().optional(),
  }).strict(),
  tolerancePercentage: z.coerce.number().finite().min(0).max(100).default(5),
  components: componentsSchema,
}).strict()

const recipeSchema = z.union([newRecipeSchema, versionSchema])

function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
  if (error instanceof InventoryDomainError) return NextResponse.json({ error: error.message }, { status: error.status })
  return NextResponse.json({ error: "No se pudo guardar la receta" }, { status: 500 })
}

export const GET = withAuth(async (_req, session) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const recipes = await prisma.recipe.findMany({
    where: { deletedAt: null },
    include: {
      product: {
        select: {
          id: true,
          code: true,
          posDescription: true,
          fullDescription: true,
          isSellable: true,
          baseStockUnit: true,
          baseUnitCost: true,
          fixedRetailPriceIncludingVat: true,
          status: true,
          appliedRetailPriceIncludingVat: true,
          targetMarginPercentage: true,
          salesVatPercentage: true,
        },
      },
      versions: {
        orderBy: { version: "desc" },
        include: {
          createdBy: { select: { name: true, email: true } },
          components: {
            include: {
              componentProduct: {
                select: {
                  id: true,
                  code: true,
                  posDescription: true,
                  baseStockUnit: true,
                  isPrepared: true,
                  baseUnitCost: true,
                  purchaseToBaseFactor: true,
                },
              },
            },
            orderBy: { componentProduct: { code: "asc" } },
          },
        },
      },
    },
    orderBy: { product: { code: "asc" } },
  })
  return NextResponse.json(recipes)
})

export const POST = withAuth(async (req, session) => {
  try {
    const input = recipeSchema.parse(await req.json())
    const recipe = "mode" in input
      ? await createRecipeWithProduct({ id: session.user.id, role: session.user.role }, input)
      : await createRecipeVersion({ id: session.user.id, role: session.user.role }, input)
    return NextResponse.json(recipe, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
})
