import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { paymentErrorResponse, parseEntity } from "@/lib/payments-http"
import { requirePaymentFunction } from "@/lib/payments"
import { CreditorStatus, FundsAccountStatus, PaymentEntity, PaymentFunction, PaymentMethodStatus } from "@/lib/database-enums"
import { getFirstSearchParam } from "@/lib/request-params"

export const GET = withAuth(async (req, session) => {
  try {
    const searchParams = new URL(req.url).searchParams
    const entity = parseEntity(getFirstSearchParam(searchParams, "entity", "entidad"))
    await requirePaymentFunction(session.user.id, PaymentFunction.REQUEST, entity, session.user.role)
    const [categories, creditors, accounts, paymentMethods] = await Promise.all([
      prisma.expenseCategory.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
      prisma.creditor.findMany({ where: { status: CreditorStatus.ACTIVE }, select: { id: true, code: true, name: true, type: true, defaultEntity: true, destinationAccountLast4: true }, orderBy: { name: "asc" } }),
      prisma.fundsAccount.findMany({ where: { ...(entity ? { entity: entity } : {}), status: FundsAccountStatus.ACTIVE }, select: { id: true, type: true, entity: true, description: true, ibanLast4: true, theoreticalBalance: true, fixedFloat: true }, orderBy: [{ entity: "asc" }, { id: "asc" }] }),
      prisma.paymentMethod.findMany({ where: { status: PaymentMethodStatus.ACTIVE }, select: { id: true, type: true, requiresAccount: true, bankReconciliable: true, transactionLimit: true }, orderBy: { id: "asc" } }),
    ])
    return NextResponse.json({
      categories,
      creditors,
      accounts,
      paymentMethods,
      entities: Object.values(PaymentEntity),
      entidades: ["OBRADOR", "CAFETERIA"],
    })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
