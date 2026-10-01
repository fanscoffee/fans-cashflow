import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { InventoryDomainError } from "@/lib/inventory-ledger"
import { activateRecipeVersion } from "@/lib/recipe-control"

export const POST = withAuth(async (_req, session, context) => {
  try {
    const { versionId } = await context.params
    return NextResponse.json(await activateRecipeVersion({ id: session.user.id, role: session.user.role }, versionId))
  } catch (error) {
    if (error instanceof InventoryDomainError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: "No se pudo activar la receta" }, { status: 500 })
  }
})
