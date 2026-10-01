import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { InventoryDomainError } from "@/lib/inventory-ledger"
import { approveProductionEntry } from "@/lib/production-control"

export const POST = withAuth(async (_req, session, context) => {
  try {
    const { productionId } = await context.params
    return NextResponse.json(await approveProductionEntry({ id: session.user.id, role: session.user.role }, productionId))
  } catch (error) {
    if (error instanceof InventoryDomainError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: "No se pudo aprobar la producción" }, { status: 500 })
  }
})
