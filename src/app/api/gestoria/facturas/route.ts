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

export const GET = withAuth(async (request, session) => {
  if (!canAccessGestoria(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search")?.trim() || ""
  const page = Math.max(1, Number(searchParams.get("page") || 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20) || 20))
  const where = search ? {
    OR: [
      { facturaNumero: { contains: search, mode: "insensitive" as const } },
      { proveedorAcreedor: { contains: search, mode: "insensitive" as const } },
      { nif: { contains: search, mode: "insensitive" as const } },
      { concepto: { contains: search, mode: "insensitive" as const } },
    ],
  } : {}

  const [facturas, total] = await Promise.all([
    prisma.facturaGestoria.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      include: { creadoPor: { select: { name: true, email: true } } },
    }),
    prisma.facturaGestoria.count({ where }),
  ])

  return NextResponse.json({ facturas: facturas.map((factura) => serializeFactura(factura as unknown as Record<string, unknown>)), total, page, pageSize })
})

export const POST = withAuth(async (request, session) => {
  if (!canAccessGestoria(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  try {
    const parsed = facturaGestoriaSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    const input = parsed.data
    const alertas = await alertsFor(input)
    const factura = await prisma.facturaGestoria.create({ data: { ...gestoriaDbData(input, session.user.id, alertas), alertas: alertas.length ? alertas : Prisma.JsonNull } })
    return NextResponse.json({ factura: serializeFactura(factura as unknown as Record<string, unknown>), alertas }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar la factura" }, { status: 500 })
  }
})
