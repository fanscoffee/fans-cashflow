import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { paymentErrorResponse } from "@/lib/pagos-http"
import { requirePaymentFunction } from "@/lib/pagos"
import { getPaymentStorage, paymentStorageBucket } from "@/lib/pagos-storage"

export const GET = withAuth(async (_req, session, context) => {
  try {
    const { id } = await context.params
    const attachment = await prisma.adjuntoPago.findUnique({ where: { id }, include: { factura: { select: { entidad: true } } } })
    if (!attachment) return NextResponse.json({ error: "Adjunto no encontrado" }, { status: 404 })
    const entity = attachment.factura?.entidad
    await requirePaymentFunction(session.user.id, "REGISTRAR", entity, session.user.role)
    const storage = getPaymentStorage()
    if (!storage) return NextResponse.json({ error: "El almacenamiento privado no está configurado" }, { status: 503 })
    const signed = await storage.storage.from(paymentStorageBucket).createSignedUrl(attachment.storageKey, 300)
    if (signed.error) return NextResponse.json({ error: "No se pudo generar el enlace del adjunto" }, { status: 502 })
    return NextResponse.json({ url: signed.data.signedUrl, expiresIn: 300 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
