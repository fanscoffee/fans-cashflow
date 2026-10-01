import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole, isRole } from "@/lib/roles"
import { InventoryDomainError } from "@/lib/inventory-ledger"
import { createProductionEntry } from "@/lib/production-control"

const productionSchema = z.object({
  shiftId: z.string().min(1).optional(),
  productId: z.string().min(1),
  quantity: z.coerce.number().finite().positive().max(1_000_000),
  actualConsumptions: z.array(z.object({
    componentProductId: z.string().min(1),
    quantity: z.coerce.number().finite().nonnegative().max(1_000_000),
  }).strict()).max(200).optional(),
  exceptionReason: z.string().trim().max(1000).optional(),
  deviationReason: z.string().trim().max(1000).optional(),
  standaloneReason: z.string().trim().max(1000).optional(),
  effectiveAt: z.string().datetime().optional(),
  allowNegative: z.boolean().optional(),
}).strict()

export const GET = withAuth(async (req, session) => {
  if (isRole(session.user.role, UserRole.BAKERY)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const shiftId = new URL(req.url).searchParams.get("shiftId") || undefined
  const manager = hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])
  if (!shiftId && !manager) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  if (shiftId && !manager) {
    const shift = await prisma.shift.findUnique({ where: { id: shiftId }, select: { createdById: true } })
    if (!shift || shift.createdById !== session.user.id) return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  }
  const productions = await prisma.productionEntry.findMany({
    where: shiftId ? { shiftId } : {},
    include: {
      product: { select: { code: true, posDescription: true, baseStockUnit: true } },
      createdBy: { select: { name: true, email: true } },
      consumptions: { include: { componentProduct: { select: { code: true, posDescription: true, baseStockUnit: true } } } },
    },
    orderBy: { effectiveAt: "desc" },
    take: shiftId ? 200 : 500,
  })
  return NextResponse.json(productions)
})

export const POST = withAuth(async (req, session) => {
  try {
    const data = productionSchema.parse(await req.json())
    const production = await createProductionEntry(
      { id: session.user.id, role: session.user.role },
      { ...data, effectiveAt: data.effectiveAt ? new Date(data.effectiveAt) : undefined },
    )
    return NextResponse.json(production, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    if (error instanceof InventoryDomainError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: "No se pudo registrar la producción" }, { status: 500 })
  }
})
