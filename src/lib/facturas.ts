import { z } from "zod"
import { toN } from "@/lib/money"

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value : null),
  z.string().nullable().refine((value) => value === null || Number.isFinite(new Date(value).getTime()), "Fecha no válida")
)

const money = z.coerce.number().finite().nonnegative()

export const facturaLineaSchema = z.object({
  productoId: z.string().nullable().optional(),
  tipoLinea: z.enum(["PRODUCTO", "CARGO"]),
  referenciaProveedor: z.string().optional().default(""),
  codigoArticulo: z.string().optional().default(""),
   descripcion: z.string().trim().min(1, "La descripción es obligatoria").max(500),
  unidadMedida: z.string().optional().default(""),
  formatoOriginal: z.string().optional().default(""),
  cantidad: money,
  descuentoPorcentaje: z.coerce.number().finite().nullable().optional(),
  descuentoImporte: money,
  precioUnitario: money,
  precioUnitarioNeto: money,
  baseImponible: money,
  tipoIva: z.coerce.number().finite().nullable().optional(),
  cuotaIva: money,
  totalLinea: money,
  lote: z.string().optional().default(""),
   fechaVencimiento: optionalDate,
 }).superRefine((linea, context) => {
   if (linea.tipoLinea === "PRODUCTO" && !linea.productoId) {
     context.addIssue({ code: "custom", path: ["productoId"], message: "La línea de producto debe usar un producto del catálogo" })
   }
 })

export const facturaImpuestoSchema = z.object({
  tipo: z.enum(["IVA", "RECARGO_EQUIVALENCIA", "IRPF"]),
  porcentaje: z.coerce.number().finite().nullable().optional(),
  baseImponible: money,
  cuota: money,
})

export const facturaSchema = z.object({
  proveedorId: z.string().min(1, "Selecciona un proveedor"),
  entidad: z.enum(["OBRADOR", "CAFETERIA"]).default("OBRADOR"),
  tipoDocumento: z.enum(["COMPRA_MERCANCIA", "GASTO"]).default("COMPRA_MERCANCIA"),
  cifReceptor: z.literal("B09711078", { error: "El CIF receptor debe ser B09711078" }),
  serie: z.string().trim().default(""),
  numero: z.string().trim().min(1, "El número de factura es obligatorio"),
  fechaExpedicion: z.string().min(1, "La fecha de expedición es obligatoria").refine((value) => Number.isFinite(new Date(value).getTime()), "Fecha no válida"),
  fechaOperacion: optionalDate,
  fechaVencimiento: optionalDate,
  fechaPago: optionalDate,
  numeroPedido: z.string().optional().default(""),
  fechaPedido: optionalDate,
  centroEntrega: z.string().optional().default(""),
  referenciaAlbaran: z.string().optional().default(""),
  fechaAlbaran: optionalDate,
  formaPago: z.string().optional().default(""),
  estadoPago: z.literal("PENDIENTE").default("PENDIENTE"),
  razonSocialEmisor: z.string().trim().min(1, "La razón social del emisor es obligatoria"),
  nifEmisor: z.string().trim().min(1, "El NIF del emisor es obligatorio"),
  domicilioFiscalEmisor: z.string().trim().min(1, "El domicilio del emisor es obligatorio"),
  totalNeto: money,
  totalDescuento: money,
  totalIva: money,
  totalRecargo: money,
  totalRetenciones: money,
  importeTotal: money,
  importePagado: z.coerce.number().finite().nonnegative().nullable().optional(),
  importeConformado: z.coerce.number().finite().nonnegative().nullable().optional(),
  importeRetenido: z.coerce.number().finite().nonnegative().default(0),
  motivoRetencion: z.string().trim().max(500).optional().default(""),
  referenciaOrigen: z.string().trim().max(120).optional().default(""),
  confirmarConAdjunto: z.boolean().default(false),
  adjuntoExistente: z.boolean().default(false),
  observaciones: z.string().optional().default(""),
  recepcionIds: z.array(z.string()).max(500).default([]),
  lineas: z.array(facturaLineaSchema).min(1, "Agrega al menos una línea").max(500),
  impuestos: z.array(facturaImpuestoSchema).max(100).default([]),
}).superRefine((factura, context) => {
  if (factura.importePagado != null && factura.importePagado > factura.importeTotal) {
    context.addIssue({ code: "custom", path: ["importePagado"], message: "El importe pagado no puede superar el total" })
  }
  if (factura.importeConformado != null && factura.importeConformado + factura.importeRetenido > factura.importeTotal) {
    context.addIssue({ code: "custom", path: ["importeConformado"], message: "El importe conformado y retenido no puede superar el total" })
  }
  if (factura.importeRetenido > 0 && !factura.motivoRetencion.trim()) {
    context.addIssue({ code: "custom", path: ["motivoRetencion"], message: "La retención debe tener un motivo" })
  }
})

export type FacturaInput = z.infer<typeof facturaSchema>

export function normalizeNif(value: string) {
  return value.replace(/[\s.-]/g, "").toUpperCase()
}

interface AlbaranLineaForValidation {
  productoId: string
  cantidadRecibida: unknown
  precioUnitario: unknown
  producto: { codigo: string; descripcionTpv: string }
}

interface InvoiceAlertResult {
  alerts: string[]
  lineAlerts: Map<number, string>
}

export function buildInvoiceAlerts(
  factura: FacturaInput,
  albaranLineas: AlbaranLineaForValidation[]
): InvoiceAlertResult {
  const alerts: string[] = []
  const lineAlerts = new Map<number, string>()
  if (factura.recepcionIds.length === 0) return { alerts, lineAlerts }

  const recibidos = new Map<string, { cantidad: number; importe: number }>()
  for (const linea of albaranLineas) {
    const current = recibidos.get(linea.productoId) || { cantidad: 0, importe: 0 }
    current.cantidad += toN(linea.cantidadRecibida)
    current.importe += toN(linea.cantidadRecibida) * toN(linea.precioUnitario)
    recibidos.set(linea.productoId, current)
  }

  const facturados = new Map<string, { cantidad: number; importe: number; indexes: number[] }>()
  factura.lineas.forEach((linea, index) => {
    if (linea.tipoLinea !== "PRODUCTO" || !linea.productoId) return
    const current = facturados.get(linea.productoId) || { cantidad: 0, importe: 0, indexes: [] }
    current.cantidad += linea.cantidad
    current.importe += linea.cantidad * linea.precioUnitarioNeto
    current.indexes.push(index)
    facturados.set(linea.productoId, current)
  })

  for (const [productoId, facturaLinea] of facturados) {
    const albaranLinea = recibidos.get(productoId)
    if (!albaranLinea) {
      const message = "Producto facturado no aparece en los albaranes vinculados"
      alerts.push(message)
      for (const index of facturaLinea.indexes) lineAlerts.set(index, message)
      continue
    }

    const quantityMismatch = Math.abs(facturaLinea.cantidad - albaranLinea.cantidad) > 0.01
    const albaranPrice = albaranLinea.cantidad > 0 ? albaranLinea.importe / albaranLinea.cantidad : 0
    const invoicePrice = facturaLinea.cantidad > 0 ? facturaLinea.importe / facturaLinea.cantidad : 0
    const priceMismatch = Math.abs(invoicePrice - albaranPrice) > 0.01
    if (quantityMismatch || priceMismatch) {
      const parts = [
        quantityMismatch ? `cantidad factura ${facturaLinea.cantidad} vs albarán ${albaranLinea.cantidad}` : "",
        priceMismatch ? `precio neto factura ${invoicePrice.toFixed(4)} vs albarán ${albaranPrice.toFixed(4)}` : "",
      ].filter(Boolean)
      const message = `Diferencia con albarán: ${parts.join("; ")}`
      alerts.push(message)
      for (const index of facturaLinea.indexes) lineAlerts.set(index, message)
    }
  }

  for (const productoId of recibidos.keys()) {
    if (!facturados.has(productoId)) {
      alerts.push("Producto recibido en albarán no aparece en la factura")
    }
  }

  return { alerts: Array.from(new Set(alerts)), lineAlerts }
}
