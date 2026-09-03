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

export const GET = withAuth(async (_request, session, context) => {
  if (!canAccessAccounting(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await context.params
  const invoice = await prisma.accountingInvoice.findUnique({ include: { createdBy: { select: { name: true, email: true } } }, where: { id } })
  if (!invoice) return NextResponse.json({ error: "Factura de gestoría no encontrada" }, { status: 404 })
  return NextResponse.json(serializeInvoice(invoice as unknown as Record<string, unknown>))
})

export const PATCH = withAuth(async (request, session, context) => {
  if (!canAccessAccounting(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await context.params

  try {
    const existing = await prisma.accountingInvoice.findUnique({ where: { id }, select: { id: true, createdById: true } })
    if (!existing) return NextResponse.json({ error: "Factura de gestoría no encontrada" }, { status: 404 })
    const parsed = accountingInvoiceSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    const input = parsed.data
    const alerts = await alertsFor(input, id)
    const invoice = await prisma.accountingInvoice.update({ where: { id }, data: { ...accountingDbData(input, existing.createdById, alerts), alerts: alerts.length ? alerts : Prisma.JsonNull } })
    return NextResponse.json({ invoice: serializeInvoice(invoice as unknown as Record<string, unknown>), alerts })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la factura" }, { status: 500 })
  }
})

export const DELETE = withAuth(async (_request, session, context) => {
  if (!canAccessAccounting(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await context.params
  try {
    const invoice = await prisma.accountingInvoice.delete({ where: { id }, select: { id: true } })
    return NextResponse.json({ ok: true, id: invoice.id })
  } catch {
    return NextResponse.json({ error: "Factura de gestoría no encontrada" }, { status: 404 })
  }
})
