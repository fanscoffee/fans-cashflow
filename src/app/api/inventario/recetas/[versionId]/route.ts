import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { InventoryDomainError } from "@/lib/inventory-ledger"
import { deleteRecipe, updateRecipe } from "@/lib/recipe-control"

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

const recipeSchema = z.object({
  product: z.object({
    posDescription: z.string().trim().min(1).max(250),
    fullDescription: z.string().trim().min(1).max(1000),
    salesVatPercentage: optionalNumber.pipe(z.number().min(0).max(100).optional()),
    salePriceIncludingVat: optionalNumber.pipe(z.number().positive().optional()),
  }).strict(),
  tolerancePercentage: z.coerce.number().finite().min(0).max(100),
  components: z.array(z.object({
    componentProductId: z.string().min(1),
    quantityPerUnit: positiveQuantity,
  }).strict()).min(1).max(200),
}).strict()

export const PATCH = withAuth(async (req, session, context) => {
  try {
    const { versionId } = await context.params
    const input = recipeSchema.parse(await req.json())
    return NextResponse.json(await updateRecipe({ id: session.user.id, role: session.user.role }, versionId, { ...input.product, tolerancePercentage: input.tolerancePercentage, components: input.components }))
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    if (error instanceof InventoryDomainError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: "No se pudo actualizar la receta" }, { status: 500 })
  }
})

export const DELETE = withAuth(async (_req, session, context) => {
  try {
    const { versionId } = await context.params
    return NextResponse.json(await deleteRecipe({ id: session.user.id, role: session.user.role }, versionId))
  } catch (error) {
    if (error instanceof InventoryDomainError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: "No se pudo eliminar la receta" }, { status: 500 })
  }
})
