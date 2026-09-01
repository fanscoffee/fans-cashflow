import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { buildCapturedGestoriaRows, buildGestoriaWorkbook, type GestoriaCapturedSource } from "@/lib/gestoria-export"
import { canAccessGestoria } from "@/lib/gestoria-facturas"

function parsePeriod(request: Request) {
  const { searchParams } = new URL(request.url)
  const now = new Date()
  const month = searchParams.has("month") ? Number(searchParams.get("month")) : now.getMonth() + 1
  const year = searchParams.has("year") ? Number(searchParams.get("year")) : now.getFullYear()
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) return null
  return {
    month,
    year,
    startDate: new Date(Date.UTC(year, month - 1, 1)),
    endDate: new Date(Date.UTC(year, month, 1)),
  }
}

export const runtime = "nodejs"

export const GET = withAuth(async (request, session) => {
  if (!canAccessGestoria(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const period = parsePeriod(request)
  if (!period) return NextResponse.json({ error: "Periodo no válido" }, { status: 400 })

  try {
    const facturas = await prisma.facturaGestoria.findMany({
      where: { fecha: { gte: period.startDate, lt: period.endDate } },
      select: {
        fecha: true,
        facturaNumero: true,
        proveedorAcreedor: true,
        nif: true,
        concepto: true,
        baseExenta: true,
        base21: true,
        iva21: true,
        base10: true,
        iva10: true,
        base4: true,
        iva4: true,
        base2: true,
        iva2: true,
        totalBase: true,
        totalIva: true,
        irpf: true,
        totalFactura: true,
        formaPago: true,
      },
      orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
    })
    const rows = buildCapturedGestoriaRows(facturas as unknown as GestoriaCapturedSource[])
    const workbook = await buildGestoriaWorkbook(rows)
    const filename = `fans-cashflow-gestoria-capturadas-${period.year}-${String(period.month).padStart(2, "0")}.xlsx`
    return new NextResponse(workbook, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch {
    return NextResponse.json({ error: "No se pudo generar la exportación de gestoría" }, { status: 500 })
  }
})
