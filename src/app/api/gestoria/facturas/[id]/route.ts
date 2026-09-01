import { NextResponse } from "next/server"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import {
  buildGestoriaAmountWarnings,
  canAccessGestoria,
  facturaGestoriaSchema,
  gestoriaDbData,
  normalizeGestoriaFacturaNumero,
  normalizeGestoriaNif,
} from "@/lib/gestoria-facturas"
import { toN } from "@/lib/money"

const decimalFields = [
  "baseExenta", "base21", "iva21", "base10", "iva10", "base4", "iva4", "base2", "iva2",
  "totalBase", "totalIva", "irpf", "totalFactura",
] as const

function serializeFactura(factura: Record<string, unknown>) {
  const result: Record<string, unknown> = { ...factura }
  if (factura.fecha instanceof Date) result.fecha = factura.fecha.toISOString()
  for (const field of decimalFields) result[field] = toN(factura[field])
  return result
}

async function alertsFor(input: ReturnType<typeof facturaGestoriaSchema.parse>, excludeId?: string) {
  const alerts = [...buildGestoriaAmountWarnings(input)]
  const nif = normalizeGestoriaNif(input.nif)
  const facturaNumero = normalizeGestoriaFacturaNumero(input.facturaNumero)
  if (nif && facturaNumero) {
    const duplicate = await prisma.facturaGestoria.findFirst({
      where: {
        nif,
        facturaNumero,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    })
    if (duplicate) alerts.push("Posible duplicado: ya existe una factura con el mismo NIF y número")
  }
  return Array.from(new Set(alerts))
}

export const GET = withAuth(async (_request, session, context) => {
  if (!canAccessGestoria(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await context.params
  const factura = await prisma.facturaGestoria.findUnique({ include: { creadoPor: { select: { name: true, email: true } } }, where: { id } })
  if (!factura) return NextResponse.json({ error: "Factura de gestoría no encontrada" }, { status: 404 })
  return NextResponse.json(serializeFactura(factura as unknown as Record<string, unknown>))
})

export const PATCH = withAuth(async (request, session, context) => {
  if (!canAccessGestoria(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await context.params

  try {
    const existing = await prisma.facturaGestoria.findUnique({ where: { id }, select: { id: true, creadoPorId: true } })
    if (!existing) return NextResponse.json({ error: "Factura de gestoría no encontrada" }, { status: 404 })
    const parsed = facturaGestoriaSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    const input = parsed.data
    const alertas = await alertsFor(input, id)
    const factura = await prisma.facturaGestoria.update({ where: { id }, data: { ...gestoriaDbData(input, existing.creadoPorId, alertas), alertas: alertas.length ? alertas : Prisma.JsonNull } })
    return NextResponse.json({ factura: serializeFactura(factura as unknown as Record<string, unknown>), alertas })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la factura" }, { status: 500 })
  }
})

export const DELETE = withAuth(async (_request, session, context) => {
  if (!canAccessGestoria(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await context.params
  try {
    const factura = await prisma.facturaGestoria.delete({ where: { id }, select: { id: true } })
    return NextResponse.json({ ok: true, id: factura.id })
  } catch {
    return NextResponse.json({ error: "Factura de gestoría no encontrada" }, { status: 404 })
  }
})
