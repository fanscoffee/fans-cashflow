import { z } from "zod"
import { normalizeNif } from "@/lib/facturas"
import { toN } from "@/lib/money"
import type { FacturaDraft } from "@/lib/factura-ocr"

function normalizeMoneyInput(value: unknown) {
  return value == null || (typeof value === "string" && !value.trim()) ? 0 : typeof value === "string" ? value.replace(",", ".") : value
}

const money = z.preprocess(normalizeMoneyInput, z.coerce.number().finite().nonnegative())
const requiredMoney = z.preprocess((value) => typeof value === "string" && !value.trim() ? undefined : normalizeMoneyInput(value), z.coerce.number().finite().nonnegative())

function isValidDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

const dateOnly = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida").refine(isValidDateOnly, "Fecha no válida")

export const facturaGestoriaSchema = z.object({
  fecha: dateOnly,
  facturaNumero: z.string().trim().max(120).default(""),
  proveedorAcreedor: z.string().trim().max(255).default(""),
  nif: z.string().trim().max(64).default(""),
  concepto: z.string().trim().max(160).default(""),
  baseExenta: money,
  base21: money,
  iva21: money,
  base10: money,
  iva10: money,
  base4: money,
  iva4: money,
  base2: money,
  iva2: money,
  totalBase: money,
  totalIva: money,
  irpf: money,
  totalFactura: requiredMoney,
  formaPago: z.string().trim().max(80).default(""),
  textoOCR: z.string().max(500_000).default(""),
  origen: z.enum(["OCR", "MANUAL"]).default("MANUAL"),
})

export type FacturaGestoriaInput = z.infer<typeof facturaGestoriaSchema>

export const GESTORIA_ROLES = ["ADMIN", "SOCIO"] as const

export function canAccessGestoria(role: string) {
  return GESTORIA_ROLES.includes(role as typeof GESTORIA_ROLES[number])
}

export interface GestoriaFacturaFormData {
  fecha: string
  facturaNumero: string
  proveedorAcreedor: string
  nif: string
  concepto: string
  baseExenta: string
  base21: string
  iva21: string
  base10: string
  iva10: string
  base4: string
  iva4: string
  base2: string
  iva2: string
  totalBase: string
  totalIva: string
  irpf: string
  totalFactura: string
  formaPago: string
  textoOCR: string
  origen: "OCR" | "MANUAL"
}

function textMoney(value: unknown) {
  return toN(value).toFixed(2)
}

export function emptyGestoriaFactura(): GestoriaFacturaFormData {
  return {
    fecha: "",
    facturaNumero: "",
    proveedorAcreedor: "",
    nif: "",
    concepto: "",
    baseExenta: "0.00",
    base21: "0.00",
    iva21: "0.00",
    base10: "0.00",
    iva10: "0.00",
    base4: "0.00",
    iva4: "0.00",
    base2: "0.00",
    iva2: "0.00",
    totalBase: "0.00",
    totalIva: "0.00",
    irpf: "0.00",
    totalFactura: "",
    formaPago: "",
    textoOCR: "",
    origen: "MANUAL",
  }
}

export function facturaDraftToGestoria(draft: FacturaDraft, textoOCR: string): GestoriaFacturaFormData {
  const form = emptyGestoriaFactura()
  const taxes = {
    baseExenta: 0,
    base21: 0,
    iva21: 0,
    base10: 0,
    iva10: 0,
    base4: 0,
    iva4: 0,
    base2: 0,
    iva2: 0,
    irpf: 0,
  }

  for (const tax of draft.impuestos) {
    const percentage = Math.round(toN(tax.porcentaje) * 100) / 100
    const base = toN(tax.baseImponible)
    const quota = toN(tax.cuota)
    if (tax.tipo === "IRPF") {
      taxes.irpf += quota
    } else if (tax.tipo === "IVA") {
      if (percentage === 21) { taxes.base21 += base; taxes.iva21 += quota }
      if (percentage === 10) { taxes.base10 += base; taxes.iva10 += quota }
      if (percentage === 4) { taxes.base4 += base; taxes.iva4 += quota }
      if (percentage === 2) { taxes.base2 += base; taxes.iva2 += quota }
      if (percentage === 0) taxes.baseExenta += base
    }
  }

  const totalBase = toN(draft.totalNeto) || taxes.base21 + taxes.base10 + taxes.base4 + taxes.base2 + taxes.baseExenta
  const totalIva = toN(draft.totalIva) || taxes.iva21 + taxes.iva10 + taxes.iva4 + taxes.iva2
  const irpf = toN(draft.totalRetenciones) || taxes.irpf
  const hasTaxRows = draft.impuestos.length > 0
  const baseExenta = taxes.baseExenta || (!hasTaxRows ? totalBase : 0)

  return {
    ...form,
    fecha: draft.fechaExpedicion,
    facturaNumero: [draft.serie, draft.numero].filter(Boolean).join("/"),
    proveedorAcreedor: draft.razonSocialEmisor.trim(),
    nif: draft.nifEmisor,
    concepto: draft.lineas.some((linea) => linea.descripcion.trim()) ? "COMPRA" : "GASTO",
    baseExenta: textMoney(baseExenta),
    base21: textMoney(taxes.base21),
    iva21: textMoney(taxes.iva21),
    base10: textMoney(taxes.base10),
    iva10: textMoney(taxes.iva10),
    base4: textMoney(taxes.base4),
    iva4: textMoney(taxes.iva4),
    base2: textMoney(taxes.base2),
    iva2: textMoney(taxes.iva2),
    totalBase: textMoney(totalBase),
    totalIva: textMoney(totalIva),
    irpf: textMoney(irpf),
    totalFactura: toN(draft.importeTotal) > 0 ? textMoney(draft.importeTotal) : "",
    formaPago: draft.formaPago,
    textoOCR,
    origen: "OCR",
  }
}

export function normalizeGestoriaNif(value: string) {
  return normalizeNif(value)
}

export function normalizeGestoriaFacturaNumero(value: string) {
  return value.trim().toUpperCase()
}

export function gestoriaDbData(input: FacturaGestoriaInput, creadoPorId: string, alertas: string[]) {
  return {
    fecha: new Date(`${input.fecha}T00:00:00.000Z`),
    facturaNumero: normalizeGestoriaFacturaNumero(input.facturaNumero),
    proveedorAcreedor: input.proveedorAcreedor,
    nif: normalizeGestoriaNif(input.nif),
    concepto: input.concepto,
    baseExenta: input.baseExenta,
    base21: input.base21,
    iva21: input.iva21,
    base10: input.base10,
    iva10: input.iva10,
    base4: input.base4,
    iva4: input.iva4,
    base2: input.base2,
    iva2: input.iva2,
    totalBase: input.totalBase,
    totalIva: input.totalIva,
    irpf: input.irpf,
    totalFactura: input.totalFactura,
    formaPago: input.formaPago,
    textoOCR: input.textoOCR || null,
    origen: input.origen,
    alertas: alertas.length ? alertas : undefined,
    creadoPorId,
  }
}

export function buildGestoriaAmountWarnings(input: Pick<FacturaGestoriaInput, "baseExenta" | "base21" | "base10" | "base4" | "base2" | "totalBase" | "totalIva" | "irpf" | "totalFactura">) {
  const hasBreakdown = input.totalBase > 0 || input.totalIva > 0 || input.irpf > 0
  if (!hasBreakdown) return []

  const expected = input.totalBase + input.totalIva - input.irpf
  if (Math.abs(expected - input.totalFactura) <= 0.02) return []
  return [`Importes no cuadran: base ${input.totalBase.toFixed(2)} + IVA ${input.totalIva.toFixed(2)} - IRPF ${input.irpf.toFixed(2)} != total ${input.totalFactura.toFixed(2)}`]
}
