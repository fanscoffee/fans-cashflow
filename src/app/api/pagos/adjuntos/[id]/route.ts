import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { paymentErrorResponse } from "@/lib/payments-http"
import { requirePaymentFunction } from "@/lib/payments"
import { getPaymentStorage, paymentStorageBucket } from "@/lib/payments-storage"
import { PaymentFunction } from "@/lib/database-enums"

export const GET = withAuth(async (_req, session, context) => {
  try {
    const { id } = await context.params
    const attachment = await prisma.paymentAttachment.findUnique({ where: { id }, include: { invoice: { select: { entity: true } } } })
    if (!attachment) return NextResponse.json({ error: "Adjunto no encontrado" }, { status: 404 })
    const entity = attachment.invoice?.entity
    if (!entity) return NextResponse.json({ error: "Adjunto no encontrado" }, { status: 404 })
    await requirePaymentFunction(session.user.id, PaymentFunction.REGISTER, entity, session.user.role)
    const storage = getPaymentStorage()
    if (!storage) return NextResponse.json({ error: "El almacenamiento privado no está configurado" }, { status: 503 })
    const signed = await storage.storage.from(paymentStorageBucket).createSignedUrl(attachment.storageKey, 300)
    if (signed.error) return NextResponse.json({ error: "No se pudo generar el enlace del adjunto" }, { status: 502 })
    return NextResponse.json({ url: signed.data.signedUrl, expiresIn: 300 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
