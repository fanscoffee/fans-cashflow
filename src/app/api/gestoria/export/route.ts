import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { buildCapturedAccountingRows, buildAccountingWorkbook, type AccountingCapturedSource } from "@/lib/accounting-export"
import { canAccessAccounting } from "@/lib/accounting-invoices"

function parseDateOnly(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split("-").map(Number)
  if (year < 2000 || year > 2100) return null

  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date
}

function parsePeriod(request: Request) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const startDate = parseDateOnly(from)
  const endDate = parseDateOnly(to)

  if (!from || !to || !startDate || !endDate || startDate > endDate) return null

  const endDateExclusive = new Date(endDate)
  endDateExclusive.setUTCDate(endDateExclusive.getUTCDate() + 1)
  return { from, to, startDate, endDate: endDateExclusive }
}

export const runtime = "nodejs"

export const GET = withAuth(async (request, session) => {
  if (!canAccessAccounting(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const period = parsePeriod(request)
  if (!period) return NextResponse.json({ error: "Periodo no válido" }, { status: 400 })

  try {
    const invoices = await prisma.accountingInvoice.findMany({
       where: { createdAt: { gte: period.startDate, lt: period.endDate } },
      select: {
        date: true,
        invoiceNumber: true,
        supplierOrCreditor: true,
        taxId: true,
        concept: true,
        exemptBase: true,
        base21: true,
        vat21: true,
        base10: true,
        vat10: true,
        base4: true,
        vat4: true,
        base2: true,
        vat2: true,
        totalBase: true,
        totalVat: true,
        withholdingTax: true,
        invoiceTotal: true,
        paymentMethod: true,
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    })
    const rows = buildCapturedAccountingRows(invoices as unknown as AccountingCapturedSource[])
    const workbook = await buildAccountingWorkbook(rows)
    const filename = `fans-cashflow-gestoria-capturadas-${period.from}-${period.to}.xlsx`
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
