import { NextResponse } from "next/server"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import {
  buildAccountingAmountWarnings,
  canAccessAccounting,
  accountingInvoiceSchema,
  accountingDbData,
  normalizeAccountingInvoiceNumber,
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
  return result
}

async function alertsFor(input: ReturnType<typeof accountingInvoiceSchema.parse>, excludeId?: string) {
  const alerts = [...buildAccountingAmountWarnings(input)]
  const taxId = normalizeAccountingTaxId(input.taxId)
  const invoiceNumber = normalizeAccountingInvoiceNumber(input.invoiceNumber)
  if (taxId && invoiceNumber) {
    const duplicate = await prisma.accountingInvoice.findFirst({
      where: {
        taxId,
        invoiceNumber,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    })
    if (duplicate) alerts.push("Posible duplicado: ya existe una factura con el mismo NIF y número")
  }
  return Array.from(new Set(alerts))
}

export const GET = withAuth(async (request, session) => {
  if (!canAccessAccounting(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search")?.trim() || ""
  const page = Math.max(1, Number(searchParams.get("page") || 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20) || 20))
  const where = search ? {
    OR: [
      { invoiceNumber: { contains: search, mode: "insensitive" as const } },
      { supplierOrCreditor: { contains: search, mode: "insensitive" as const } },
      { taxId: { contains: search, mode: "insensitive" as const } },
      { concept: { contains: search, mode: "insensitive" as const } },
    ],
  } : {}

  const [invoices, total] = await Promise.all([
    prisma.accountingInvoice.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { createdBy: { select: { name: true, email: true } } },
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
