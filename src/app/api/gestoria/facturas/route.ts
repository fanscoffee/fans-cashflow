import { NextResponse } from "next/server"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import {
  buildAccountingAmountWarnings,
  canAccessAccounting,
  accountingInvoiceSchema,
  accountingDbData,
  calculateAccountingTotals,
  comparableAccountingInvoiceNumber,
  normalizeAccountingInvoiceNumber,
  normalizeAccountingInvoiceReference,
  normalizeAccountingTaxId,
} from "@/lib/accounting-invoices"
import { toN } from "@/lib/money"

const decimalFields = [
  "exemptBase", "base21", "vat21", "base10", "vat10", "base4", "vat4", "base2", "vat2",
  "totalBase", "totalVat", "withholdingTax", "invoiceTotal",
] as const

function serializeInvoice(invoice: Record<string, unknown>) {
  const result: Record<string, unknown> = { ...invoice }
  if (invoice.date instanceof Date) result.date = invoice.date.toISOString()
  for (const field of decimalFields) result[field] = toN(invoice[field])
  const totals = calculateAccountingTotals(result)
  result.totalBase = totals.totalBase
  result.totalVat = totals.totalVat
  result.invoiceTotal = totals.invoiceTotal
  return result
}

async function alertsFor(input: ReturnType<typeof accountingInvoiceSchema.parse>, excludeId?: string) {
  const alerts = [...buildAccountingAmountWarnings({ ...input, ...calculateAccountingTotals(input) })]
  const taxId = normalizeAccountingTaxId(input.taxId)
  const invoiceNumber = normalizeAccountingInvoiceNumber(input.invoiceNumber)
  if (taxId && invoiceNumber) {
    const [duplicate, operationalCandidates] = await Promise.all([
      prisma.accountingInvoice.findFirst({
        where: {
          taxId,
          invoiceNumber,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      }),
      prisma.invoice.findMany({
        where: {
          OR: [
            { issuerTaxId: { in: [taxId, input.taxId.trim().toUpperCase()] } },
            { supplier: { taxId } },
          ],
        },
        select: { id: true, series: true, number: true, issuerTaxId: true, supplier: { select: { taxId: true } } },
      }),
    ])
    if (duplicate) alerts.push("Posible duplicado: ya existe una captura con el mismo NIF y número")
    const operationalDuplicate = operationalCandidates.find((candidate) => {
      const taxIds = [candidate.issuerTaxId, candidate.supplier.taxId].map(normalizeAccountingTaxId)
      return taxIds.includes(taxId) && comparableAccountingInvoiceNumber(candidate.series, candidate.number) === normalizeAccountingInvoiceReference(invoiceNumber)
    })
    if (operationalDuplicate) alerts.push("Posible duplicado: ya existe una factura operativa con el mismo NIF y número; revisa si debes vincular la captura existente")
  }
  return Array.from(new Set(alerts))
}

export const GET = withAuth(async (request, session) => {
  if (!canAccessAccounting(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search")?.trim() || ""
  const page = Math.max(1, Number(searchParams.get("page") || 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20) || 20))
  const requestedMonth = Number(searchParams.get("month") || "")
  const requestedYear = Number(searchParams.get("year") || "")
  const month = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : null
  const year = Number.isInteger(requestedYear) && requestedYear >= 1900 && requestedYear <= 2200 ? requestedYear : null
  let monthInvoiceIds: string[] | undefined

  if (month && !year) {
    const matchingInvoices = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "AccountingInvoice"
      WHERE EXTRACT(MONTH FROM "date") = ${month}
    `)
    monthInvoiceIds = matchingInvoices.map((invoice) => invoice.id)
  }

  const dateFilter = year
    ? { gte: new Date(Date.UTC(year, month ? month - 1 : 0, 1)), lt: new Date(Date.UTC(year, month || 12, 1)) }
    : undefined
  const where: Prisma.AccountingInvoiceWhereInput = {
    ...(search ? {
      OR: [
        { invoiceNumber: { contains: search, mode: "insensitive" as const } },
        { supplierOrCreditor: { contains: search, mode: "insensitive" as const } },
        { taxId: { contains: search, mode: "insensitive" as const } },
        { concept: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
    ...(dateFilter ? { date: dateFilter } : {}),
    ...(monthInvoiceIds ? { id: { in: monthInvoiceIds } } : {}),
  }

  const [invoices, total] = await Promise.all([
    prisma.accountingInvoice.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        createdBy: { select: { name: true, email: true } },
        inventoryInvoice: { select: { id: true } },
      },
    }),
    prisma.accountingInvoice.count({ where }),
  ])

  return NextResponse.json({ invoices: invoices.map((invoice) => serializeInvoice(invoice as unknown as Record<string, unknown>)), total, page, pageSize })
})

export const POST = withAuth(async (request, session) => {
  if (!canAccessAccounting(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  try {
    const parsed = accountingInvoiceSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    const input = parsed.data
    const alerts = await alertsFor(input)
    const invoice = await prisma.accountingInvoice.create({ data: { ...accountingDbData(input, session.user.id, alerts), alerts: alerts.length ? alerts : Prisma.JsonNull } })
    return NextResponse.json({ invoice: serializeInvoice(invoice as unknown as Record<string, unknown>), alerts }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar la factura" }, { status: 500 })
  }
})
