import { z } from "zod"
import { toN } from "@/lib/money"
import { parsePaymentDocumentType, parsePaymentEntity } from "@/lib/database-enums"

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value : null),
  z.string().nullable().refine((value) => value === null || Number.isFinite(new Date(value).getTime()), "Fecha no válida")
)

const money = z.coerce.number().finite().nonnegative()

export const invoiceLineSchema = z.object({
  productId: z.string().nullable().optional(),
  lineType: z.enum(["PRODUCTO", "CARGO"]),
  supplierReference: z.string().optional().default(""),
  itemCode: z.string().optional().default(""),
   description: z.string().trim().min(1, "La descripción es obligatoria").max(500),
  unitOfMeasure: z.string().optional().default(""),
  originalFormat: z.string().optional().default(""),
  quantity: money,
  discountPercentage: z.coerce.number().finite().nullable().optional(),
  discountAmount: money,
  unitPrice: money,
  netUnitPrice: money,
  taxableBase: money,
  vatRate: z.coerce.number().finite().nullable().optional(),
  vatAmount: money,
  lineTotal: money,
  batch: z.string().optional().default(""),
   dueDate: optionalDate,
 }).superRefine((line, context) => {
   if (line.lineType === "PRODUCTO" && !line.productId) {
     context.addIssue({ code: "custom", path: ["productId"], message: "La línea de producto debe usar un producto del catálogo" })
   }
 })

export const invoiceTaxSchema = z.object({
  type: z.enum(["IVA", "RECARGO_EQUIVALENCIA", "IRPF"]),
  percentage: z.coerce.number().finite().nullable().optional(),
  taxableBase: money,
  taxAmount: money,
})

export const invoiceSchema = z.object({
  supplierId: z.string().min(1, "Selecciona un proveedor"),
  entity: z.string().default("BAKERY").transform((value, context) => {
    const parsed = parsePaymentEntity(value)
    if (!parsed) {
      context.addIssue({ code: "custom", message: "Entidad no válida" })
      return z.NEVER
    }
    return parsed
  }),
  documentType: z.string().default("MERCHANDISE_PURCHASE").transform((value, context) => {
    const parsed = parsePaymentDocumentType(value)
    if (!parsed) {
      context.addIssue({ code: "custom", message: "Tipo de documento no válido" })
      return z.NEVER
    }
    return parsed
  }),
  recipientTaxId: z.literal("B09711078", { error: "El CIF receptor debe ser B09711078" }),
  series: z.string().trim().default(""),
  number: z.string().trim().min(1, "El número de factura es obligatorio"),
  issueDate: z.string().min(1, "La fecha de expedición es obligatoria").refine((value) => Number.isFinite(new Date(value).getTime()), "Fecha no válida"),
  operationDate: optionalDate,
  dueDate: optionalDate,
  paymentDate: optionalDate,
  orderNumber: z.string().optional().default(""),
  orderDate: optionalDate,
  deliveryCenter: z.string().optional().default(""),
  deliveryNoteReference: z.string().optional().default(""),
  deliveryNoteDate: optionalDate,
  paymentMethod: z.string().optional().default(""),
  paymentStatus: z.literal("PENDIENTE").default("PENDIENTE"),
  issuerLegalName: z.string().trim().min(1, "La razón social del emisor es obligatoria"),
  issuerTaxId: z.string().trim().min(1, "El NIF del emisor es obligatorio"),
  issuerBillingAddress: z.string().trim().min(1, "El domicilio del emisor es obligatorio"),
  netTotal: money,
  discountTotal: money,
  totalVat: money,
  surchargeTotal: money,
  withholdingTotal: money,
  totalAmount: money,
  paidAmount: z.coerce.number().finite().nonnegative().nullable().optional(),
  confirmedAmount: z.coerce.number().finite().nonnegative().nullable().optional(),
  withheldAmount: z.coerce.number().finite().nonnegative().default(0),
  withholdingReason: z.string().trim().max(500).optional().default(""),
  sourceReference: z.string().trim().max(120).optional().default(""),
  confirmConAttachment: z.boolean().default(false),
  existingAttachment: z.boolean().default(false),
  notes: z.string().optional().default(""),
  receiptIds: z.array(z.string()).max(500).default([]),
  lines: z.array(invoiceLineSchema).min(1, "Agrega al menos una línea").max(500),
  taxes: z.array(invoiceTaxSchema).max(100).default([]),
}).superRefine((invoice, context) => {
  if (invoice.paidAmount != null && invoice.paidAmount > invoice.totalAmount) {
    context.addIssue({ code: "custom", path: ["paidAmount"], message: "El importe pagado no puede superar el total" })
  }
  if (invoice.confirmedAmount != null && invoice.confirmedAmount + invoice.withheldAmount > invoice.totalAmount) {
    context.addIssue({ code: "custom", path: ["confirmedAmount"], message: "El importe conformado y retenido no puede superar el total" })
  }
  if (invoice.withheldAmount > 0 && !invoice.withholdingReason.trim()) {
    context.addIssue({ code: "custom", path: ["withholdingReason"], message: "La retención debe tener un motivo" })
  }
})

export type InvoiceInput = z.infer<typeof invoiceSchema>

export function normalizeTaxId(value: string) {
  return value.replace(/[\s.-]/g, "").toUpperCase()
}

interface DeliveryNoteLineForValidation {
  productId: string
  receivedQuantity: unknown
  unitPrice: unknown
  product: { code: string; posDescription: string }
}

interface InvoiceAlertResult {
  alerts: string[]
  lineAlerts: Map<number, string>
}

export function buildInvoiceAlerts(
  invoice: InvoiceInput,
  deliveryNoteLines: DeliveryNoteLineForValidation[]
): InvoiceAlertResult {
  const alerts: string[] = []
  const lineAlerts = new Map<number, string>()
  if (invoice.receiptIds.length === 0) return { alerts, lineAlerts }

  const receivedItems = new Map<string, { quantity: number; amount: number }>()
  for (const line of deliveryNoteLines) {
    const current = receivedItems.get(line.productId) || { quantity: 0, amount: 0 }
    current.quantity += toN(line.receivedQuantity)
    current.amount += toN(line.receivedQuantity) * toN(line.unitPrice)
    receivedItems.set(line.productId, current)
  }

  const invoicedItems = new Map<string, { quantity: number; amount: number; indexes: number[] }>()
  invoice.lines.forEach((line, index) => {
    if (line.lineType !== "PRODUCTO" || !line.productId) return
    const current = invoicedItems.get(line.productId) || { quantity: 0, amount: 0, indexes: [] }
    current.quantity += line.quantity
    current.amount += line.quantity * line.netUnitPrice
    current.indexes.push(index)
    invoicedItems.set(line.productId, current)
  })

  for (const [productId, invoiceLine] of invoicedItems) {
    const deliveryNoteLine = receivedItems.get(productId)
    if (!deliveryNoteLine) {
      const message = "Producto facturado no aparece en los albaranes vinculados"
      alerts.push(message)
      for (const index of invoiceLine.indexes) lineAlerts.set(index, message)
      continue
    }

    const quantityMismatch = Math.abs(invoiceLine.quantity - deliveryNoteLine.quantity) > 0.01
    const deliveryNotePrice = deliveryNoteLine.quantity > 0 ? deliveryNoteLine.amount / deliveryNoteLine.quantity : 0
    const invoicePrice = invoiceLine.quantity > 0 ? invoiceLine.amount / invoiceLine.quantity : 0
    const priceMismatch = Math.abs(invoicePrice - deliveryNotePrice) > 0.01
    if (quantityMismatch || priceMismatch) {
      const parts = [
        quantityMismatch ? `cantidad factura ${invoiceLine.quantity} vs albarán ${deliveryNoteLine.quantity}` : "",
        priceMismatch ? `precio neto factura ${invoicePrice.toFixed(4)} vs albarán ${deliveryNotePrice.toFixed(4)}` : "",
      ].filter(Boolean)
      const message = `Diferencia con albarán: ${parts.join("; ")}`
      alerts.push(message)
      for (const index of invoiceLine.indexes) lineAlerts.set(index, message)
    }
  }

  for (const productId of receivedItems.keys()) {
    if (!invoicedItems.has(productId)) {
      alerts.push("Producto recibido en albarán no aparece en la factura")
    }
  }

  return { alerts: Array.from(new Set(alerts)), lineAlerts }
}
