import { createHash, randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction, PaymentDomainError } from "@/lib/pagos"
import { paymentErrorResponse } from "@/lib/pagos-http"
import { getPaymentStorage, paymentStorageBucket } from "@/lib/pagos-storage"

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"])
const maxSize = 6 * 1024 * 1024

export const POST = withAuth(async (req, session) => {
  try {
    const form = await req.formData()
    const file = form.get("file")
    const facturaId = String(form.get("facturaId") || "")
    const gastoId = String(form.get("gastoId") || "")
    if (!(file instanceof File)) throw new PaymentDomainError("El archivo es obligatorio", 400, "ATTACHMENT_REQUIRED")
    if (Boolean(facturaId) === Boolean(gastoId)) throw new PaymentDomainError("Indica una factura o un gasto, no ambos", 400, "ATTACHMENT_TARGET_INVALID")
    if (!allowedTypes.has(file.type) || file.size <= 0 || file.size > maxSize) throw new PaymentDomainError("El adjunto debe ser PDF, JPG o PNG de hasta 6 MB", 400, "ATTACHMENT_INVALID")

    const target = facturaId
      ? await prisma.factura.findUnique({ where: { id: facturaId }, select: { id: true, entidad: true } })
      : await prisma.gastoCorriente.findUnique({ where: { id: gastoId }, select: { id: true, entidad: true } })
    if (!target) throw new PaymentDomainError("Documento no encontrado", 404, "DOCUMENT_NOT_FOUND")
    await requirePaymentFunction(session.user.id, "REGISTRAR", target.entidad, session.user.role)

    const storage = getPaymentStorage()
    if (!storage) throw new PaymentDomainError("El almacenamiento privado no está configurado", 503, "STORAGE_NOT_CONFIGURED")
    const bytes = Buffer.from(await file.arrayBuffer())
    const digest = createHash("sha256").update(bytes).digest("hex")
    const targetType = facturaId ? "facturas" : "gastos"
    const storageKey = `${target.entidad.toLowerCase()}/${targetType}/${target.id}/${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    const upload = await storage.storage.from(paymentStorageBucket).upload(storageKey, bytes, { contentType: file.type, upsert: false })
    if (upload.error) throw new PaymentDomainError("No se pudo guardar el adjunto", 502, "STORAGE_UPLOAD_FAILED")

    const attachment = await prisma.adjuntoPago.create({ data: { storageKey, nombreArchivo: file.name, mimeType: file.type, tamano: file.size, sha256: digest, facturaId: facturaId || null, gastoId: gastoId || null, subidoPorId: session.user.id } })
    await auditPaymentEvent(prisma, { actorId: session.user.id, accion: "ADJUNTO_SUBIDO", tipoRegistro: facturaId ? "Factura" : "GastoCorriente", registroId: target.id, entidad: target.entidad, despues: { adjuntoId: attachment.id, sha256: digest } })
    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
