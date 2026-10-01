import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole, isRole } from "@/lib/roles"
import { InventoryDomainError } from "@/lib/inventory-ledger"
import { createWasteEntry } from "@/lib/production-control"

const wasteSchema = z.object({
  shiftId: z.string().min(1).optional(),
  productId: z.string().min(1),
  reasonId: z.string().min(1),
  quantity: z.coerce.number().finite().positive().max(1_000_000),
  notes: z.string().trim().max(1000).optional(),
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
  const waste = await prisma.wasteEntry.findMany({
    where: shiftId ? { shiftId } : {},
    include: {
      product: { select: { code: true, posDescription: true, baseStockUnit: true } },
      reason: true,
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { effectiveAt: "desc" },
    take: shiftId ? 200 : 500,
  })
  return NextResponse.json(waste)
})

export const POST = withAuth(async (req, session) => {
  try {
    const data = wasteSchema.parse(await req.json())
    const waste = await createWasteEntry(
      { id: session.user.id, role: session.user.role },
      { ...data, effectiveAt: data.effectiveAt ? new Date(data.effectiveAt) : undefined },
    )
    return NextResponse.json(waste, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    if (error instanceof InventoryDomainError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: "No se pudo registrar la merma" }, { status: 500 })
  }
})
