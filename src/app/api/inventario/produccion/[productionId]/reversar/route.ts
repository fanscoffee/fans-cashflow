import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { InventoryDomainError } from "@/lib/inventory-ledger"
import { reverseProductionEntry } from "@/lib/production-control"

const schema = z.object({ reason: z.string().trim().min(3).max(1000) }).strict()

export const POST = withAuth(async (req, session, context) => {
  try {
    const { productionId } = await context.params
    const { reason } = schema.parse(await req.json())
    return NextResponse.json(await reverseProductionEntry({ id: session.user.id, role: session.user.role }, productionId, reason))
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    if (error instanceof InventoryDomainError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: "No se pudo reversar la producción" }, { status: 500 })
  }
})
