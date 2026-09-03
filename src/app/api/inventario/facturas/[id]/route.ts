import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { buildInvoiceAlerts, invoiceSchema, normalizeTaxId } from "@/lib/invoices"
import { auditPaymentEvent, ensureCreditorForSupplier } from "@/lib/payments"
import { getPaymentStorage, paymentStorageBucket } from "@/lib/payments-storage"
import { InvoiceWorkflowStatus, UserRole, parseInvoiceWorkflowStatus } from "@/lib/database-enums"
import { hasAnyRole, isRole } from "@/lib/roles"

const lineData = (line: ReturnType<typeof invoiceSchema.parse>["lines"][number], validationAlert: string | null) => ({
  productId: line.productId || null,
  lineType: line.lineType,
  supplierReference: line.supplierReference || null,
  itemCode: line.itemCode || null,
  description: line.description,
  unitOfMeasure: line.unitOfMeasure || null,
  originalFormat: line.originalFormat || null,
  quantity: line.quantity,
  discountPercentage: line.discountPercentage ?? null,
  discountAmount: line.discountAmount,
  unitPrice: line.unitPrice,
  netUnitPrice: line.netUnitPrice,
  taxableBase: line.taxableBase,
  vatRate: line.vatRate ?? null,
  vatAmount: line.vatAmount,
  lineTotal: line.lineTotal,
  batch: line.batch || null,
  dueDate: line.dueDate ? new Date(line.dueDate) : null,
  validationAlert,
})

export const GET = withAuth(async (_req, session, context) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await context.params
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, legalName: true, taxId: true, billingAddress: true } },
      confirmedBy: { select: { name: true } },
      deliveryNotes: { select: { id: true, deliveryNoteCode: true, receivedAt: true } },
      lines: { include: { product: { select: { id: true, code: true, posDescription: true, purchaseUnit: true } } }, orderBy: { createdAt: "asc" } },
      taxes: { orderBy: { createdAt: "asc" } },
      attachments: { select: { id: true, fileName: true, mimeType: true } },
    },
  })
  if (!invoice) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
  return NextResponse.json(invoice)
})

export const PATCH = withAuth(async (req, session, context) => {
  if (!isRole(session.user.role, UserRole.ADMIN)) return NextResponse.json({ error: "Solo ADMIN puede editar facturas confirmadas" }, { status: 403 })
  const { id } = await context.params

  try {
    const existing = await prisma.invoice.findUnique({ where: { id }, select: { id: true, workflowStatus: true } })
    if (!existing) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
    const existingWorkflowStatus = parseInvoiceWorkflowStatus(existing.workflowStatus)
    if (existingWorkflowStatus === InvoiceWorkflowStatus.CONFIRMED || existingWorkflowStatus === InvoiceWorkflowStatus.PARTIALLY_CONFIRMED) return NextResponse.json({ error: "Una factura conformada debe corregirse mediante una incidencia o abono" }, { status: 409 })
    const parsed = invoiceSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    const data = parsed.data
    const series = data.series.trim()
    const receiptIds = Array.from(new Set(data.receiptIds))
    const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId }, select: { id: true, taxId: true } })
    if (!supplier) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 400 })
    if (normalizeTaxId(supplier.taxId) !== normalizeTaxId(data.issuerTaxId)) return NextResponse.json({ error: "El NIF del emisor no coincide con el proveedor" }, { status: 400 })

    const duplicate = await prisma.invoice.findFirst({ where: { supplierId: data.supplierId, series, number: data.number, NOT: { id } }, select: { id: true } })
    if (duplicate) return NextResponse.json({ error: "Ya existe una factura con ese proveedor, serie y número" }, { status: 409 })

    const deliveryNotes = receiptIds.length
      ? await prisma.receipt.findMany({
          where: { id: { in: receiptIds }, supplierId: data.supplierId, OR: [{ invoiceId: null }, { invoiceId: id }] },
          include: { lines: { include: { product: { select: { code: true, posDescription: true } } } } },
        })
      : []
    if (deliveryNotes.length !== receiptIds.length) return NextResponse.json({ error: "Uno o más albaranes no están disponibles para esta factura" }, { status: 409 })

    const productIds = Array.from(new Set(data.lines.filter((line) => line.lineType === "PRODUCTO").map((line) => line.productId).filter(Boolean))) as string[]
    const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } })
    if (products.length !== productIds.length) return NextResponse.json({ error: "Toda línea de producto debe usar un producto del catálogo" }, { status: 400 })
    const validation = buildInvoiceAlerts(data, deliveryNotes.flatMap((deliveryNote) => deliveryNote.lines))

    const invoice = await prisma.$transaction(async (tx) => {
      const creditor = await ensureCreditorForSupplier(tx, { id: data.supplierId, legalName: data.issuerLegalName, taxId: data.issuerTaxId }, session.user.id)
      await tx.receipt.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } })
      if (receiptIds.length) await tx.receipt.updateMany({ where: { id: { in: receiptIds }, invoiceId: null }, data: { invoiceId: id } })
      return tx.invoice.update({
        where: { id },
        data: {
          supplierId: data.supplierId,
          creditorId: creditor.id,
          entity: data.entity,
          documentType: data.documentType,
          workflowStatus: InvoiceWorkflowStatus.DRAFT,
          confirmedAmount: null,
          withheldAmount: 0,
          withholdingReason: null,
          sourceReference: null,
          series,
          number: data.number,
          issueDate: new Date(data.issueDate),
          operationDate: data.operationDate ? new Date(data.operationDate) : null,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          paymentDate: data.paymentDate ? new Date(data.paymentDate) : null,
          orderNumber: data.orderNumber || null,
          orderDate: data.orderDate ? new Date(data.orderDate) : null,
          deliveryCenter: data.deliveryCenter || null,
          deliveryNoteReference: data.deliveryNoteReference || null,
          deliveryNoteDate: data.deliveryNoteDate ? new Date(data.deliveryNoteDate) : null,
          paymentMethod: data.paymentMethod || null,
          paymentStatus: "PENDIENTE",
          paidAmount: data.paidAmount ?? null,
          issuerLegalName: data.issuerLegalName,
          issuerTaxId: data.issuerTaxId,
          issuerBillingAddress: data.issuerBillingAddress,
          netTotal: data.netTotal,
          discountTotal: data.discountTotal,
          totalVat: data.totalVat,
          surchargeTotal: data.surchargeTotal,
          withholdingTotal: data.withholdingTotal,
          totalAmount: data.totalAmount,
          notes: data.notes || null,
          alerts: validation.alerts.length ? validation.alerts : undefined,
          confirmedById: session.user.id,
          confirmedAt: new Date(),
          lines: { deleteMany: {}, create: data.lines.map((line, index) => lineData(line, validation.lineAlerts.get(index) || null)) },
          taxes: { deleteMany: {}, create: data.taxes.map((tax) => tax) },
        },
      })
    })
    return NextResponse.json({ invoice, alerts: validation.alerts })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al editar factura" }, { status: 500 })
  }
})

export const DELETE = withAuth(async (_req, session, context) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) return NextResponse.json({ error: "Solo ADMIN y SOCIO pueden eliminar facturas" }, { status: 403 })
  const { id } = await context.params

  try {
    const existing = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        entity: true,
        series: true,
        number: true,
        status: true,
        paymentStatus: true,
        workflowStatus: true,
        paidAmount: true,
        totalAmount: true,
        attachments: { select: { storageKey: true } },
        _count: { select: { applications: true } },
      },
    })
    if (!existing) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })

    const hasPayments = existing._count.applications > 0 ||
      ["PARCIAL", "PAGADA"].includes(existing.paymentStatus) ||
      Number(existing.paidAmount || 0) > 0
    if (hasPayments) {
      return NextResponse.json(
        { error: "No se puede eliminar una factura con pagos registrados", code: "INVOICE_HAS_PAYMENTS" },
        { status: 409 },
      )
    }

    const storageKeys = existing.attachments.map((attachment) => attachment.storageKey)
    await prisma.$transaction(async (tx) => {
      await tx.receipt.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } })
      await auditPaymentEvent(tx, {
        actorId: session.user.id,
        action: "FACTURA_ELIMINADA",
        recordType: "Factura",
        recordId: id,
        entity: existing.entity,
        before: {
          series: existing.series,
          number: existing.number,
          status: existing.status,
          paymentStatus: existing.paymentStatus,
          workflowStatus: existing.workflowStatus,
          totalAmount: String(existing.totalAmount),
        },
      })
      await tx.invoice.delete({ where: { id } })
    })

    if (storageKeys.length > 0) {
      const storage = getPaymentStorage()
      if (storage) {
        const { error } = await storage.storage.from(paymentStorageBucket).remove(storageKeys)
        if (error) console.error("Not all invoice attachments could be deleted", id, error)
      }
    }

    return NextResponse.json({ ok: true, id })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al eliminar factura" }, { status: 500 })
  }
})
