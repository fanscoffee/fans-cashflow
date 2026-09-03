import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import {
  buildAccountingRows,
  buildAccountingWorkbook,
  type AccountingExpenseSource,
  type AccountingInvoiceSource,
  type AccountingLegacyExpenseSource,
} from "@/lib/accounting-export"
import { CurrentExpenseStatus, InvoiceWorkflowStatus, PaymentStatus, UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

export const runtime = "nodejs"

const INVOICE_STATES = [InvoiceWorkflowStatus.CONFIRMED, InvoiceWorkflowStatus.PARTIALLY_CONFIRMED, InvoiceWorkflowStatus.VOID] as const
const EXPENSE_STATES = [CurrentExpenseStatus.AUTHORIZED, CurrentExpenseStatus.PAID, CurrentExpenseStatus.CLOSED] as const

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
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const period = parsePeriod(request)
  if (!period) return NextResponse.json({ error: "Periodo no válido" }, { status: 400 })

  try {
    const [invoices, expenses, expensesLegacy] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          issueDate: { gte: period.startDate, lt: period.endDate },
          workflowStatus: { in: [...INVOICE_STATES] },
        },
        select: {
          series: true,
          number: true,
          issueDate: true,
          documentType: true,
          workflowStatus: true,
          paymentMethod: true,
          issuerLegalName: true,
          issuerTaxId: true,
          netTotal: true,
          totalVat: true,
          withholdingTotal: true,
          totalAmount: true,
          supplier: { select: { legalName: true, taxId: true } },
          creditor: { select: { name: true, taxId: true, type: true } },
          taxes: { select: { type: true, percentage: true, taxableBase: true, taxAmount: true } },
          applications: {
            where: { payment: { status: { not: PaymentStatus.VOID } } },
            select: { payment: { select: { paymentMethod: { select: { type: true } } } } },
          },
        },
        orderBy: [{ issueDate: "asc" }, { createdAt: "asc" }],
      }),
      prisma.currentExpense.findMany({
        where: {
          accrualDate: { gte: period.startDate, lt: period.endDate },
          status: { in: [...EXPENSE_STATES] },
        },
        select: {
          accrualDate: true,
          concept: true,
          amount: true,
          receipt: true,
          category: { select: { name: true } },
          creditor: { select: { name: true, taxId: true, type: true } },
          applications: {
            where: { payment: { status: { not: PaymentStatus.VOID } } },
            select: { payment: { select: { paymentMethod: { select: { type: true } } } } },
          },
        },
        orderBy: [{ accrualDate: "asc" }, { createdAt: "asc" }],
      }),
      prisma.expense.findMany({
        where: { shift: { date: { gte: period.startDate, lt: period.endDate } } },
        select: { amount: true, supplier: true, shift: { select: { date: true, shift: true } } },
        orderBy: { shift: { date: "asc" } },
      }),
    ])

    const rows = buildAccountingRows({
      invoices: invoices as unknown as AccountingInvoiceSource[],
      expenses: expenses as unknown as AccountingExpenseSource[],
      expensesLegacy: expensesLegacy as unknown as AccountingLegacyExpenseSource[],
    })
    const workbook = await buildAccountingWorkbook(rows)
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
