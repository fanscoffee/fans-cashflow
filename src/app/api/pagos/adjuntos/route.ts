import { createHash, randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction, PaymentDomainError } from "@/lib/pagos"
import { paymentErrorResponse } from "@/lib/pagos-http"
import { getPaymentStorage, paymentStorageBucket } from "@/lib/pagos-storage"

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"])
const maxSize = 6 * 1024 * 1024

function detectMimeType(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf"
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png"
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "image/jpeg"
  return null
}

export const POST = withAuth(async (req, session) => {
  try {
    const form = await req.formData()
    const file = form.get("file")
    const facturaId = String(form.get("facturaId") || "")
    const gastoId = String(form.get("gastoId") || "")
    if (gastoId) throw new PaymentDomainError("Los gastos corrientes no aceptan justificantes adjuntos", 409, "EXPENSE_ATTACHMENTS_DISABLED")
    if (!(file instanceof File)) throw new PaymentDomainError("El archivo es obligatorio", 400, "ATTACHMENT_REQUIRED")
    if (!facturaId) throw new PaymentDomainError("Indica una factura para el adjunto", 400, "ATTACHMENT_TARGET_INVALID")
    if (!allowedTypes.has(file.type) || file.size <= 0 || file.size > maxSize) throw new PaymentDomainError("El adjunto debe ser PDF, JPG o PNG de hasta 6 MB", 400, "ATTACHMENT_INVALID")

    const target = await prisma.factura.findUnique({ where: { id: facturaId }, select: { id: true, entidad: true } })
    if (!target) throw new PaymentDomainError("Documento no encontrado", 404, "DOCUMENT_NOT_FOUND")
    await requirePaymentFunction(session.user.id, "REGISTRAR", target.entidad, session.user.role)

    const storage = getPaymentStorage()
    if (!storage) throw new PaymentDomainError("El almacenamiento privado no está configurado", 503, "STORAGE_NOT_CONFIGURED")
    const bytes = Buffer.from(await file.arrayBuffer())
    const detectedType = detectMimeType(bytes)
    if (detectedType !== file.type) throw new PaymentDomainError("El contenido del adjunto no coincide con su tipo declarado", 400, "ATTACHMENT_CONTENT_INVALID")
    const digest = createHash("sha256").update(bytes).digest("hex")
    const targetType = "facturas"
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "documento"
    const storageKey = `${target.entidad.toLowerCase()}/${targetType}/${target.id}/${randomUUID()}-${safeName}`
    const upload = await storage.storage.from(paymentStorageBucket).upload(storageKey, bytes, { contentType: file.type, upsert: false })
    if (upload.error) throw new PaymentDomainError("No se pudo guardar el adjunto", 502, "STORAGE_UPLOAD_FAILED")

    try {
      const attachment = await prisma.$transaction(async (tx) => {
        const created = await tx.adjuntoPago.create({ data: { storageKey, nombreArchivo: file.name.slice(0, 255), mimeType: file.type, tamano: bytes.length, sha256: digest, facturaId, subidoPorId: session.user.id } })
        await auditPaymentEvent(tx, { actorId: session.user.id, accion: "ADJUNTO_SUBIDO", tipoRegistro: "Factura", registroId: target.id, entidad: target.entidad, despues: { adjuntoId: created.id, sha256: digest } })
        return created
      })
      return NextResponse.json(attachment, { status: 201 })
    } catch (error) {
      await storage.storage.from(paymentStorageBucket).remove([storageKey])
      throw error
    }
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
