import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction } from "@/lib/payments"
import { paymentErrorResponse } from "@/lib/payments-http"
import { CreditorStatus, PaymentFunction, parseCreditorStatus } from "@/lib/database-enums"

const changeSchema = z.object({ newAccountLast4: z.string().regex(/^\d{4}$/), reason: z.string().trim().min(3).max(500) })
const authorizeSchema = z.object({ action: z.literal("AUTORIZAR"), confirmationChannel: z.string().trim().min(2).max(80) })

export const GET = withAuth(async (_req, session, context) => {
  try {
    const { id } = await context.params
    await requirePaymentFunction(session.user.id, PaymentFunction.ADMINISTER, undefined, session.user.role)
    return NextResponse.json(await prisma.creditorAccountChange.findMany({ where: { creditorId: id }, include: { requestedBy: { select: { id: true, name: true, email: true } }, authorizedBy: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } }))
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session, context) => {
  try {
    const { id } = await context.params
    const input = changeSchema.parse(await req.json())
    const creditor = await prisma.creditor.findUnique({ where: { id }, select: { id: true, defaultEntity: true, destinationAccountLast4: true, status: true } })
    if (!creditor || parseCreditorStatus(creditor.status) !== CreditorStatus.ACTIVE) return NextResponse.json({ error: "Acreedor no disponible" }, { status: 409 })
    await requirePaymentFunction(session.user.id, PaymentFunction.ADMINISTER, creditor.defaultEntity || undefined, session.user.role)
    const change = await prisma.creditorAccountChange.create({ data: { creditorId: id, previousAccountLast4: creditor.destinationAccountLast4, newAccountLast4: input.newAccountLast4, reason: input.reason, requestedById: session.user.id } })
    await auditPaymentEvent(prisma, { actorId: session.user.id, action: "CAMBIO_CUENTA_SOLICITADO", recordType: "Acreedor", recordId: id, entity: creditor.defaultEntity || undefined, reason: input.reason, after: { changeId: change.id, newAccountLast4: input.newAccountLast4 } })
    return NextResponse.json(change, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const PATCH = withAuth(async (req, session, context) => {
  try {
    const { id } = await context.params
    const input = authorizeSchema.parse(await req.json())
    const change = await prisma.creditorAccountChange.findUnique({ where: { id }, include: { creditor: true } })
    if (!change) return NextResponse.json({ error: "Solicitud de cambio no encontrada" }, { status: 404 })
    await requirePaymentFunction(session.user.id, PaymentFunction.AUTHORIZE, change.creditor.defaultEntity || undefined, session.user.role)
    if (change.requestedById === session.user.id) return NextResponse.json({ error: "La segunda autorización debe ser de otra persona" }, { status: 409 })
    if (change.status !== "PENDIENTE") return NextResponse.json({ error: "El cambio ya fue resuelto" }, { status: 409 })
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.creditorAccountChange.update({ where: { id }, data: { status: "AUTORIZADO", authorizedById: session.user.id, authorizedAt: new Date(), confirmationChannel: input.confirmationChannel } })
      await tx.creditor.update({ where: { id: change.creditorId }, data: { destinationAccountLast4: change.newAccountLast4 } })
    await auditPaymentEvent(tx, { actorId: session.user.id, action: "CAMBIO_CUENTA_AUTORIZADO", recordType: "Acreedor", recordId: change.creditorId, entity: change.creditor.defaultEntity || undefined, after: { changeId: id, newAccountLast4: change.newAccountLast4, channel: input.confirmationChannel } })
      return result
    })
    return NextResponse.json(updated)
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
