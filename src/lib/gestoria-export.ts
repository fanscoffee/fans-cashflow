import ExcelJS from "exceljs"
import { toN } from "@/lib/money"

export const GESTORIA_SHEET_NAME = "Gastos y Compras Fans"

export const GESTORIA_HEADERS = [
  "Nº",
  "Fecha",
  "Factura Nº",
  "Proveedor / Acreedor",
  "NIF",
  "Concepto",
  "BASE EXENTA",
  "Base Imponible 21%",
  "21% IVA",
  "Base Imponible 10%",
  "10% IVA",
  "Base Imponible 4%",
  "4% IVA",
  "Base Imponible 2%",
  "2% IVA",
  "TOTAL BASE IMPONIBLE",
  "TOTAL CUOTA IVA",
  "IRPF",
  "TOTAL FACTURA",
  "FORMA PAGO",
] as const

type NumericValue = number | string | { toString(): string } | null | undefined

type TaxSource = {
  tipo: string
  porcentaje: NumericValue
  baseImponible: NumericValue
  cuota: NumericValue
}

type PaymentSource = {
  pago: {
    medioPago: { tipo: string }
  }
}

type CreditorSource = {
  nombre: string
  nif: string | null
  tipo?: string
}

export type GestoriaInvoiceSource = {
  serie: string
  numero: string
  fechaExpedicion: Date
  tipoDocumento: string
  estadoCircuito: string
  formaPago: string | null
  razonSocialEmisor: string
  nifEmisor: string
  totalNeto: NumericValue
  totalIva: NumericValue
  totalRetenciones: NumericValue
  importeTotal: NumericValue
  proveedor: { razonSocial: string; cifNif: string }
  acreedor: CreditorSource | null
  impuestos: TaxSource[]
  aplicaciones: PaymentSource[]
}

export type GestoriaExpenseSource = {
  fechaDevengo: Date
  concepto: string
  importe: NumericValue
  justificante: string
  categoria: { nombre: string }
  acreedor: CreditorSource | null
  aplicaciones: PaymentSource[]
}

export type GestoriaLegacyExpenseSource = {
  importe: NumericValue
  proveedor: string
  shift: { date: Date; turno: string }
}

export type GestoriaExportRow = {
  numero: number
  fecha: Date
  facturaNumero: string
  proveedor: string
  nif: string
  concepto: string
  baseExenta: number
  base21: number
  iva21: number
  base10: number
  iva10: number
  base4: number
  iva4: number
  base2: number
  iva2: number
  totalBase: number
  totalIva: number
  irpf: number
  totalFactura: number
  formaPago: string
  anulada?: boolean
}

export type GestoriaSources = {
  facturas: GestoriaInvoiceSource[]
  gastos: GestoriaExpenseSource[]
  gastosLegacy: GestoriaLegacyExpenseSource[]
}

const PAYMENT_LABELS: Record<string, string> = {
  TRANSFERENCIA: "BANCO",
  DOMICILIACION: "BANCO",
  EFECTIVO: "EFECTIVO",
  TARJETA: "TARJETA",
  CHEQUE: "CHEQUE",
  PAGO_MOVIL: "PAGO MÓVIL",
}

const CREDITOR_CONCEPTS: Record<string, string> = {
  PROVEEDOR_MERCANCIA: "COMPRA",
  SERVICIOS: "SERVICIOS",
  PERSONAL: "PERSONAL",
  ADMINISTRACION: "ADMINISTRACION",
  OTROS: "GASTO",
}

function money(value: NumericValue) {
  return Math.round(toN(value) * 100) / 100
}

function paymentForm(explicit: string | null, applications: PaymentSource[]) {
  const explicitValue = explicit?.trim()
  if (explicitValue) {
    const normalized = explicitValue.toUpperCase()
    if (normalized.includes("TRANSFER") || normalized.includes("BANCO")) return "BANCO"
    if (normalized.includes("EFECTIVO")) return "EFECTIVO"
    return explicitValue.toUpperCase()
  }

  const types = Array.from(new Set(applications.map((application) => application.pago.medioPago.tipo)))
  const labels = types.map((type) => PAYMENT_LABELS[type] || type)
  const hasBank = labels.includes("BANCO")
  const hasCash = labels.includes("EFECTIVO")
  if (hasBank && hasCash) return "BANCO Y EFECTIVO"
  return labels.join(", ")
}

function conceptForInvoice(invoice: GestoriaInvoiceSource) {
  if (invoice.tipoDocumento === "COMPRA_MERCANCIA") return "COMPRA"
  return CREDITOR_CONCEPTS[invoice.acreedor?.tipo || ""] || "GASTO"
}

function addTax(row: GestoriaExportRow, tax: TaxSource) {
  if (tax.tipo === "IRPF") {
    row.irpf += money(tax.cuota)
    return
  }
  if (tax.tipo !== "IVA") return

  const percentage = money(tax.porcentaje)
  const base = money(tax.baseImponible)
  const quota = money(tax.cuota)
  if (percentage === 21) {
    row.base21 += base
    row.iva21 += quota
  } else if (percentage === 10) {
    row.base10 += base
    row.iva10 += quota
  } else if (percentage === 4) {
    row.base4 += base
    row.iva4 += quota
  } else if (percentage === 2) {
    row.base2 += base
    row.iva2 += quota
  } else if (percentage === 0) {
    row.baseExenta += base
  }
}

function invoiceRow(invoice: GestoriaInvoiceSource): GestoriaExportRow {
  const row: GestoriaExportRow = {
    numero: 0,
    fecha: invoice.fechaExpedicion,
    facturaNumero: invoice.serie ? `${invoice.serie}/${invoice.numero}` : invoice.numero,
    proveedor: invoice.proveedor.razonSocial || invoice.razonSocialEmisor,
    nif: invoice.proveedor.cifNif || invoice.nifEmisor,
    concepto: conceptForInvoice(invoice),
    baseExenta: 0,
    base21: 0,
    iva21: 0,
    base10: 0,
    iva10: 0,
    base4: 0,
    iva4: 0,
    base2: 0,
    iva2: 0,
    totalBase: money(invoice.totalNeto),
    totalIva: money(invoice.totalIva),
    irpf: money(invoice.totalRetenciones),
    totalFactura: money(invoice.importeTotal),
    formaPago: paymentForm(invoice.formaPago, invoice.aplicaciones),
    anulada: invoice.estadoCircuito === "ANULADA",
  }

  for (const tax of invoice.impuestos) addTax(row, tax)
  if (row.baseExenta + row.base21 + row.base10 + row.base4 + row.base2 === 0 && row.totalBase > 0 && invoice.impuestos.length === 0) {
    row.baseExenta = row.totalBase
  }
  if (row.anulada) row.concepto = "ANULADA"
  return row
}

function expenseRow(expense: GestoriaExpenseSource): GestoriaExportRow {
  const provider = expense.acreedor?.nombre || expense.categoria.nombre || "Gasto corriente"
  return {
    numero: 0,
    fecha: expense.fechaDevengo,
    facturaNumero: "",
    proveedor: provider,
    nif: expense.acreedor?.nif || "",
    concepto: expense.categoria.nombre.toUpperCase() || expense.concepto.toUpperCase(),
    baseExenta: money(expense.importe),
    base21: 0,
    iva21: 0,
    base10: 0,
    iva10: 0,
    base4: 0,
    iva4: 0,
    base2: 0,
    iva2: 0,
    totalBase: money(expense.importe),
    totalIva: 0,
    irpf: 0,
    totalFactura: money(expense.importe),
    formaPago: paymentForm(null, expense.aplicaciones),
  }
}

function legacyExpenseRow(expense: GestoriaLegacyExpenseSource): GestoriaExportRow {
  const amount = money(expense.importe)
  return {
    numero: 0,
    fecha: expense.shift.date,
    facturaNumero: "",
    proveedor: expense.proveedor,
    nif: "",
    concepto: "GASTO TURNO LEGACY",
    baseExenta: amount,
    base21: 0,
    iva21: 0,
    base10: 0,
    iva10: 0,
    base4: 0,
    iva4: 0,
    base2: 0,
    iva2: 0,
    totalBase: amount,
    totalIva: 0,
    irpf: 0,
    totalFactura: amount,
    formaPago: "EFECTIVO",
  }
}

export function buildGestoriaRows(sources: GestoriaSources) {
  return [
    ...sources.facturas.map(invoiceRow),
    ...sources.gastos.map(expenseRow),
    ...sources.gastosLegacy.map(legacyExpenseRow),
  ]
    .sort((left, right) => left.fecha.getTime() - right.fecha.getTime() || left.proveedor.localeCompare(right.proveedor, "es"))
    .map((row, index) => ({ ...row, numero: index + 1 }))
}

function rowValues(row: GestoriaExportRow) {
  return [
    row.numero,
    row.fecha,
    row.facturaNumero,
    row.proveedor,
    row.nif,
    row.concepto,
    row.baseExenta,
    row.base21,
    row.iva21,
    row.base10,
    row.iva10,
    row.base4,
    row.iva4,
    row.base2,
    row.iva2,
    row.totalBase,
    row.totalIva,
    row.irpf,
    row.totalFactura,
    row.formaPago,
  ]
}

function totalValues(rows: GestoriaExportRow[]) {
  const included = rows.filter((row) => !row.anulada)
  const total = (selector: (row: GestoriaExportRow) => number) => money(included.reduce((sum, row) => sum + selector(row), 0))
  return [
    "TOTAL",
    null,
    null,
    null,
    null,
    null,
    total((row) => row.baseExenta),
    total((row) => row.base21),
    total((row) => row.iva21),
    total((row) => row.base10),
    total((row) => row.iva10),
    total((row) => row.base4),
    total((row) => row.iva4),
    total((row) => row.base2),
    total((row) => row.iva2),
    total((row) => row.totalBase),
    total((row) => row.totalIva),
    total((row) => row.irpf),
    total((row) => row.totalFactura),
    null,
  ]
}

export async function buildGestoriaWorkbook(rows: GestoriaExportRow[]) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Fans Cashflow"
  workbook.modified = new Date()

  const sheet = workbook.addWorksheet(GESTORIA_SHEET_NAME, {
    views: [{ state: "frozen", ySplit: 1 }],
  })
  sheet.columns = [
    { width: 8 },
    { width: 13 },
    { width: 18 },
    { width: 36 },
    { width: 16 },
    { width: 18 },
    ...Array.from({ length: 9 }, () => ({ width: 17 })),
    { width: 20 },
    { width: 19 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
  ]

  const header = sheet.addRow([...GESTORIA_HEADERS])
  header.height = 34
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } }
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF163A5C" } },
    }
  })

  for (const [index, row] of rows.entries()) {
    const excelRow = sheet.addRow(rowValues(row))
    excelRow.getCell(2).numFmt = "dd/mm/yyyy"
    excelRow.eachCell((cell, columnNumber) => {
      cell.alignment = { vertical: "middle", wrapText: columnNumber >= 4 && columnNumber <= 6 }
      if (index % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F6F9" } }
    })
  }

  const totalRow = sheet.addRow(totalValues(rows))
  totalRow.font = { bold: true }
  totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } }
  totalRow.border = { top: { style: "medium", color: { argb: "FF1F4E78" } } }

  for (const columnNumber of Array.from({ length: 13 }, (_, index) => index + 7)) {
    sheet.getColumn(columnNumber).numFmt = "#,##0.00"
  }
  sheet.getColumn(2).numFmt = "dd/mm/yyyy"
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rows.length + 1), column: GESTORIA_HEADERS.length },
  }
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  sheet.properties.defaultRowHeight = 20

  return workbook.xlsx.writeBuffer()
}
