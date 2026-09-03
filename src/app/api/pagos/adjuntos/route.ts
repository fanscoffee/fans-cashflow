import { createHash, randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction, PaymentDomainError } from "@/lib/payments"
import { paymentErrorResponse } from "@/lib/payments-http"
import { getPaymentStorage, paymentStorageBucket } from "@/lib/payments-storage"
import { PaymentFunction } from "@/lib/database-enums"
import { getFirstFormValue } from "@/lib/request-params"

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
    const invoiceId = String(getFirstFormValue(form, "invoiceId", "facturaId") || "")
    const currentExpenseId = String(getFirstFormValue(form, "currentExpenseId", "gastoId") || "")
    if (currentExpenseId) throw new PaymentDomainError("Los gastos corrientes no aceptan justificantes adjuntos", 409, "EXPENSE_ATTACHMENTS_DISABLED")
    if (!(file instanceof File)) throw new PaymentDomainError("El archivo es obligatorio", 400, "ATTACHMENT_REQUIRED")
    if (!invoiceId) throw new PaymentDomainError("Indica una factura para el adjunto", 400, "ATTACHMENT_TARGET_INVALID")
    if (!allowedTypes.has(file.type) || file.size <= 0 || file.size > maxSize) throw new PaymentDomainError("El adjunto debe ser PDF, JPG o PNG de hasta 6 MB", 400, "ATTACHMENT_INVALID")

    const target = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, entity: true } })
    if (!target) throw new PaymentDomainError("Documento no encontrado", 404, "DOCUMENT_NOT_FOUND")
    await requirePaymentFunction(session.user.id, PaymentFunction.REGISTER, target.entity, session.user.role)

    const storage = getPaymentStorage()
    if (!storage) throw new PaymentDomainError("El almacenamiento privado no está configurado", 503, "STORAGE_NOT_CONFIGURED")
    const bytes = Buffer.from(await file.arrayBuffer())
    const detectedType = detectMimeType(bytes)
    if (detectedType !== file.type) throw new PaymentDomainError("El contenido del adjunto no coincide con su tipo declarado", 400, "ATTACHMENT_CONTENT_INVALID")
    const digest = createHash("sha256").update(bytes).digest("hex")
    const targetType = "facturas"
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "documento"
    const storageKey = `${target.entity.toLowerCase()}/${targetType}/${target.id}/${randomUUID()}-${safeName}`
    const upload = await storage.storage.from(paymentStorageBucket).upload(storageKey, bytes, { contentType: file.type, upsert: false })
    if (upload.error) throw new PaymentDomainError("No se pudo guardar el adjunto", 502, "STORAGE_UPLOAD_FAILED")

    try {
      const attachment = await prisma.$transaction(async (tx) => {
        const created = await tx.paymentAttachment.create({ data: { storageKey, fileName: file.name.slice(0, 255), mimeType: file.type, sizeBytes: bytes.length, sha256: digest, invoiceId, uploadedById: session.user.id } })
        await auditPaymentEvent(tx, { actorId: session.user.id, action: "ADJUNTO_SUBIDO", recordType: "Factura", recordId: target.id, entity: target.entity, after: { attachmentId: created.id, sha256: digest } })
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
