import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { buildInvoiceAlerts, invoiceSchema, normalizeTaxId } from "@/lib/invoices"
import { ensureCreditorForSupplier } from "@/lib/payments"
import { InvoiceWorkflowStatus, UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"
import { getFirstSearchParam } from "@/lib/request-params"

function canAccess(role: string) {
  return hasAnyRole(role, [UserRole.ADMIN, UserRole.PARTNER])
}

function lineData(line: ReturnType<typeof invoiceSchema.parse>["lines"][number], validationAlert: string | null) {
  return {
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
  }
}

export const GET = withAuth(async (req, session) => {
  if (!canAccess(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const supplierId = getFirstSearchParam(searchParams, "supplierId", "proveedorId") || ""
  const status = getFirstSearchParam(searchParams, "status", "estado") || ""
  const page = Math.max(1, Number(searchParams.get("page") || 1))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20)))
  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { number: { contains: search, mode: "insensitive" } },
      { series: { contains: search, mode: "insensitive" } },
      { issuerTaxId: { contains: search, mode: "insensitive" } },
      { issuerLegalName: { contains: search, mode: "insensitive" } },
    ]
  }
  if (supplierId) where.supplierId = supplierId
  if (status) where.status = status

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      include: {
        supplier: { select: { id: true, legalName: true, taxId: true } },
        confirmedBy: { select: { name: true } },
        _count: { select: { lines: true, deliveryNotes: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ])

  return NextResponse.json({ invoices, total, page, pageSize })
})

export const POST = withAuth(async (req, session) => {
  if (!canAccess(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  try {
    const parsed = invoiceSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    const data = parsed.data
    const series = data.series.trim()
    const receiptIds = Array.from(new Set(data.receiptIds))

    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
      select: { id: true, legalName: true, taxId: true, billingAddress: true },
    })
    if (!supplier) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 400 })
    if (normalizeTaxId(supplier.taxId) !== normalizeTaxId(data.issuerTaxId)) {
      return NextResponse.json({ error: "El NIF del emisor no coincide con el proveedor" }, { status: 400 })
    }

    const duplicate = await prisma.invoice.findUnique({
      where: { supplierId_series_number: { supplierId: data.supplierId, series, number: data.number } },
      select: { id: true },
    })
    if (duplicate) return NextResponse.json({ error: "Ya existe una factura con ese proveedor, serie y número" }, { status: 409 })

    const deliveryNotes = receiptIds.length
      ? await prisma.receipt.findMany({
          where: { id: { in: receiptIds }, supplierId: data.supplierId, invoiceId: null },
          include: { lines: { include: { product: { select: { code: true, posDescription: true } } } } },
        })
      : []
    if (deliveryNotes.length !== receiptIds.length) {
      return NextResponse.json({ error: "Uno o más albaranes ya están vinculados, no existen o pertenecen a otro proveedor" }, { status: 409 })
    }

    const productIds = Array.from(new Set(data.lines.filter((line) => line.lineType === "PRODUCTO").map((line) => line.productId).filter(Boolean))) as string[]
    const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } })
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "Toda línea de producto debe usar un producto del catálogo" }, { status: 400 })
    }

    const deliveryNoteLines = deliveryNotes.flatMap((deliveryNote) => deliveryNote.lines)
    const validation = buildInvoiceAlerts(data, deliveryNoteLines)
    const alerts = validation.alerts

    const invoice = await prisma.$transaction(async (tx) => {
      const creditor = await ensureCreditorForSupplier(tx, supplier, session.user.id)
      const created = await tx.invoice.create({
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
          status: "CONFIRMADA",
          paymentStatus: "PENDIENTE",
          currency: "EUR",
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
          alerts: alerts.length ? alerts : undefined,
          confirmedById: session.user.id,
          lines: { create: data.lines.map((line, index) => lineData(line, validation.lineAlerts.get(index) || null)) },
          taxes: { create: data.taxes.map((tax) => tax) },
        },
      })

      if (receiptIds.length) {
        const linked = await tx.receipt.updateMany({ where: { id: { in: receiptIds }, invoiceId: null }, data: { invoiceId: created.id } })
        if (linked.count !== receiptIds.length) throw new Error("Los albaranes cambiaron durante el alta")
      }
      return created
    })

    return NextResponse.json({ invoice, alerts }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al crear factura" }, { status: 500 })
  }
})
