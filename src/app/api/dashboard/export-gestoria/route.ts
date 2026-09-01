import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import {
  buildGestoriaRows,
  buildGestoriaWorkbook,
  type GestoriaExpenseSource,
  type GestoriaInvoiceSource,
  type GestoriaLegacyExpenseSource,
} from "@/lib/gestoria-export"

export const runtime = "nodejs"

const INVOICE_STATES = ["CONFORMADA", "PARCIALMENTE_CONFORMADA", "ANULADA"] as const
const EXPENSE_STATES = ["AUTORIZADO", "PAGADO", "CERRADO"] as const

function parsePeriod(request: Request) {
  const { searchParams } = new URL(request.url)
  const now = new Date()
  const month = searchParams.has("month") ? Number(searchParams.get("month")) : now.getMonth() + 1
  const year = searchParams.has("year") ? Number(searchParams.get("year")) : now.getFullYear()

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return null
  }

  return {
    month,
    year,
    startDate: new Date(Date.UTC(year, month - 1, 1)),
    endDate: new Date(Date.UTC(year, month, 1)),
  }
}

export const GET = withAuth(async (request, session) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const period = parsePeriod(request)
  if (!period) return NextResponse.json({ error: "Periodo no válido" }, { status: 400 })

  try {
    const [facturas, gastos, gastosLegacy] = await Promise.all([
      prisma.factura.findMany({
        where: {
          fechaExpedicion: { gte: period.startDate, lt: period.endDate },
          estadoCircuito: { in: [...INVOICE_STATES] },
        },
        select: {
          serie: true,
          numero: true,
          fechaExpedicion: true,
          tipoDocumento: true,
          estadoCircuito: true,
          formaPago: true,
          razonSocialEmisor: true,
          nifEmisor: true,
          totalNeto: true,
          totalIva: true,
          totalRetenciones: true,
          importeTotal: true,
          proveedor: { select: { razonSocial: true, cifNif: true } },
          acreedor: { select: { nombre: true, nif: true, tipo: true } },
          impuestos: { select: { tipo: true, porcentaje: true, baseImponible: true, cuota: true } },
          aplicaciones: {
            where: { pago: { estado: { not: "ANULADO" } } },
            select: { pago: { select: { medioPago: { select: { tipo: true } } } } },
          },
        },
        orderBy: [{ fechaExpedicion: "asc" }, { createdAt: "asc" }],
      }),
      prisma.gastoCorriente.findMany({
        where: {
          fechaDevengo: { gte: period.startDate, lt: period.endDate },
          estado: { in: [...EXPENSE_STATES] },
        },
        select: {
          fechaDevengo: true,
          concepto: true,
          importe: true,
          justificante: true,
          categoria: { select: { nombre: true } },
          acreedor: { select: { nombre: true, nif: true, tipo: true } },
          aplicaciones: {
            where: { pago: { estado: { not: "ANULADO" } } },
            select: { pago: { select: { medioPago: { select: { tipo: true } } } } },
          },
        },
        orderBy: [{ fechaDevengo: "asc" }, { createdAt: "asc" }],
      }),
      prisma.expense.findMany({
        where: { shift: { date: { gte: period.startDate, lt: period.endDate } } },
        select: { importe: true, proveedor: true, shift: { select: { date: true, turno: true } } },
        orderBy: { shift: { date: "asc" } },
      }),
    ])

    const rows = buildGestoriaRows({
      facturas: facturas as unknown as GestoriaInvoiceSource[],
      gastos: gastos as unknown as GestoriaExpenseSource[],
      gastosLegacy: gastosLegacy as unknown as GestoriaLegacyExpenseSource[],
    })
    const workbook = await buildGestoriaWorkbook(rows)
    const filename = `fans-cashflow-gestoria-${period.year}-${String(period.month).padStart(2, "0")}.xlsx`

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
