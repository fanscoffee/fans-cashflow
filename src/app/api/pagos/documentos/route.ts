import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { paymentErrorResponse } from "@/lib/payments-http"
import { requirePaymentFunction } from "@/lib/payments"
import { parseEntity } from "@/lib/payments-http"
import { CurrentExpenseStatus, InvoiceWorkflowStatus, PaymentFunction, PaymentStatus } from "@/lib/database-enums"
import { getFirstSearchParam } from "@/lib/request-params"

export const GET = withAuth(async (req, session) => {
  try {
    const searchParams = new URL(req.url).searchParams
    const entity = parseEntity(getFirstSearchParam(searchParams, "entity", "entidad"))
    await requirePaymentFunction(session.user.id, PaymentFunction.EXECUTE, entity, session.user.role)
    const [invoices, expenses] = await Promise.all([
      prisma.invoice.findMany({
        where: { ...(entity ? { entity: entity } : {}), workflowStatus: { in: [InvoiceWorkflowStatus.CONFIRMED, InvoiceWorkflowStatus.PARTIALLY_CONFIRMED] }, creditorId: { not: null } },
        include: { creditor: { select: { id: true, code: true, name: true } }, applications: { where: { payment: { status: { not: PaymentStatus.VOID } } }, select: { appliedAmount: true } }, attachments: { select: { id: true, fileName: true, mimeType: true } } },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      }),
      prisma.currentExpense.findMany({
        where: { ...(entity ? { entity: entity } : {}), status: CurrentExpenseStatus.AUTHORIZED },
        include: { category: true, creditor: { select: { id: true, code: true, name: true } }, applications: { where: { payment: { status: { not: PaymentStatus.VOID } } }, select: { appliedAmount: true } } },
        orderBy: { accrualDate: "asc" },
      }),
    ])
    return NextResponse.json({ invoices, expenses })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
