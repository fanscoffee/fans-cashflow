import { z } from "zod"
import { toN } from "@/lib/money"

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value : null),
  z.string().nullable()
)

const money = z.coerce.number().finite()

export const facturaLineaSchema = z.object({
  productoId: z.string().nullable().optional(),
  tipoLinea: z.enum(["PRODUCTO", "CARGO"]),
  referenciaProveedor: z.string().optional().default(""),
  codigoArticulo: z.string().optional().default(""),
  descripcion: z.string().trim().min(1, "La descripción es obligatoria"),
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
})

export const facturaImpuestoSchema = z.object({
  tipo: z.enum(["IVA", "RECARGO_EQUIVALENCIA", "IRPF"]),
  porcentaje: z.coerce.number().finite().nullable().optional(),
  baseImponible: money,
  cuota: money,
})

export const facturaSchema = z.object({
  proveedorId: z.string().min(1, "Selecciona un proveedor"),
  cifReceptor: z.literal("B09711078", { error: "El CIF receptor debe ser B09711078" }),
  serie: z.string().trim().default(""),
  numero: z.string().trim().min(1, "El número de factura es obligatorio"),
  fechaExpedicion: z.string().min(1, "La fecha de expedición es obligatoria"),
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
  importePagado: z.coerce.number().finite().nullable().optional(),
  observaciones: z.string().optional().default(""),
  recepcionIds: z.array(z.string()).default([]),
  lineas: z.array(facturaLineaSchema).min(1, "Agrega al menos una línea"),
  impuestos: z.array(facturaImpuestoSchema).default([]),
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
