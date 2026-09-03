import ExcelJS from "exceljs"
import { toN } from "@/lib/money"

export const ACCOUNTING_SHEET_NAME = "Gastos y Compras Fans"

export const ACCOUNTING_HEADERS = [
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
  type: string
  percentage: NumericValue
  taxableBase: NumericValue
  taxAmount: NumericValue
}

type PaymentSource = {
  payment: {
    paymentMethod: { type: string }
  }
}

type CreditorSource = {
  name: string
  taxId: string | null
  type?: string
}

export type AccountingInvoiceSource = {
  series: string
  number: string
  issueDate: Date
  documentType: string
  workflowStatus: string
  paymentMethod: string | null
  issuerLegalName: string
  issuerTaxId: string
  netTotal: NumericValue
  totalVat: NumericValue
  withholdingTotal: NumericValue
  totalAmount: NumericValue
  supplier: { legalName: string; taxId: string }
  creditor: CreditorSource | null
  taxes: TaxSource[]
  applications: PaymentSource[]
}

export type AccountingExpenseSource = {
  accrualDate: Date
  concept: string
  amount: NumericValue
  receipt: string
  category: { name: string }
  creditor: CreditorSource | null
  applications: PaymentSource[]
}

export type AccountingLegacyExpenseSource = {
  amount: NumericValue
  supplier: string
  shift: { date: Date; shift: string }
}

export type AccountingCapturedSource = {
  date: Date
  invoiceNumber: string
  supplierOrCreditor: string
  taxId: string
  concept: string
  exemptBase: NumericValue
  base21: NumericValue
  vat21: NumericValue
  base10: NumericValue
  vat10: NumericValue
  base4: NumericValue
  vat4: NumericValue
  base2: NumericValue
  vat2: NumericValue
  totalBase: NumericValue
  totalVat: NumericValue
  withholdingTax: NumericValue
  invoiceTotal: NumericValue
  paymentMethod: string
}

export type AccountingExportRow = {
  number: number
  date: Date
  invoiceNumber: string
  supplier: string
  taxId: string
  concept: string
  exemptBase: number
  base21: number
  vat21: number
  base10: number
  vat10: number
  base4: number
  vat4: number
  base2: number
  vat2: number
  totalBase: number
  totalVat: number
  withholdingTax: number
  invoiceTotal: number
  paymentMethod: string
  voided?: boolean
}

export type AccountingSources = {
  invoices: AccountingInvoiceSource[]
  expenses: AccountingExpenseSource[]
  expensesLegacy: AccountingLegacyExpenseSource[]
}

const PAYMENT_LABELS: Record<string, string> = {
  BANK_TRANSFER: "BANCO",
  DIRECT_DEBIT: "BANCO",
  CASH: "EFECTIVO",
  CARD: "TARJETA",
  CHECK: "CHEQUE",
  MOBILE_PAYMENT: "PAGO MÓVIL",
  TRANSFERENCIA: "BANCO",
  DOMICILIACION: "BANCO",
  EFECTIVO: "EFECTIVO",
  TARJETA: "TARJETA",
  CHEQUE: "CHEQUE",
  PAGO_MOVIL: "PAGO MÓVIL",
}

const CREDITOR_CONCEPTS: Record<string, string> = {
  MERCHANDISE_SUPPLIER: "COMPRA",
  SERVICES: "SERVICIOS",
  STAFF: "PERSONAL",
  ADMINISTRATION: "ADMINISTRACION",
  OTHER: "GASTO",
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

  const types = Array.from(new Set(applications.map((application) => application.payment.paymentMethod.type)))
  const labels = types.map((type) => PAYMENT_LABELS[type] || type)
  const hasBank = labels.includes("BANCO")
  const hasCash = labels.includes("EFECTIVO")
  if (hasBank && hasCash) return "BANCO Y EFECTIVO"
  return labels.join(", ")
}

function conceptForInvoice(invoice: AccountingInvoiceSource) {
  if (invoice.documentType === "COMPRA_MERCANCIA") return "COMPRA"
  return CREDITOR_CONCEPTS[invoice.creditor?.type || ""] || "GASTO"
}

function addTax(row: AccountingExportRow, tax: TaxSource) {
  if (tax.type === "IRPF") {
    row.withholdingTax += money(tax.taxAmount)
    return
  }
  if (tax.type !== "IVA") return

  const percentage = money(tax.percentage)
  const base = money(tax.taxableBase)
  const quota = money(tax.taxAmount)
  if (percentage === 21) {
    row.base21 += base
    row.vat21 += quota
  } else if (percentage === 10) {
    row.base10 += base
    row.vat10 += quota
  } else if (percentage === 4) {
    row.base4 += base
    row.vat4 += quota
  } else if (percentage === 2) {
    row.base2 += base
    row.vat2 += quota
  } else if (percentage === 0) {
    row.exemptBase += base
  }
}

function invoiceRow(invoice: AccountingInvoiceSource): AccountingExportRow {
  const row: AccountingExportRow = {
    number: 0,
    date: invoice.issueDate,
    invoiceNumber: invoice.series ? `${invoice.series}/${invoice.number}` : invoice.number,
    supplier: invoice.supplier.legalName || invoice.issuerLegalName,
    taxId: invoice.supplier.taxId || invoice.issuerTaxId,
    concept: conceptForInvoice(invoice),
    exemptBase: 0,
    base21: 0,
    vat21: 0,
    base10: 0,
    vat10: 0,
    base4: 0,
    vat4: 0,
    base2: 0,
    vat2: 0,
    totalBase: money(invoice.netTotal),
    totalVat: money(invoice.totalVat),
    withholdingTax: money(invoice.withholdingTotal),
    invoiceTotal: money(invoice.totalAmount),
    paymentMethod: paymentForm(invoice.paymentMethod, invoice.applications),
    voided: invoice.workflowStatus === "ANULADA",
  }

  for (const tax of invoice.taxes) addTax(row, tax)
  if (row.exemptBase + row.base21 + row.base10 + row.base4 + row.base2 === 0 && row.totalBase > 0 && invoice.taxes.length === 0) {
    row.exemptBase = row.totalBase
  }
  if (row.voided) row.concept = "ANULADA"
  return row
}

function expenseRow(expense: AccountingExpenseSource): AccountingExportRow {
  const provider = expense.creditor?.name || expense.category.name || "Gasto corriente"
  return {
    number: 0,
    date: expense.accrualDate,
    invoiceNumber: "",
    supplier: provider,
    taxId: expense.creditor?.taxId || "",
    concept: expense.category.name.toUpperCase() || expense.concept.toUpperCase(),
    exemptBase: money(expense.amount),
    base21: 0,
    vat21: 0,
    base10: 0,
    vat10: 0,
    base4: 0,
    vat4: 0,
    base2: 0,
    vat2: 0,
    totalBase: money(expense.amount),
    totalVat: 0,
    withholdingTax: 0,
    invoiceTotal: money(expense.amount),
    paymentMethod: paymentForm(null, expense.applications),
  }
}

function legacyExpenseRow(expense: AccountingLegacyExpenseSource): AccountingExportRow {
  const amount = money(expense.amount)
  return {
    number: 0,
    date: expense.shift.date,
    invoiceNumber: "",
    supplier: expense.supplier,
    taxId: "",
    concept: "GASTO TURNO LEGACY",
    exemptBase: amount,
    base21: 0,
    vat21: 0,
    base10: 0,
    vat10: 0,
    base4: 0,
    vat4: 0,
    base2: 0,
    vat2: 0,
    totalBase: amount,
    totalVat: 0,
    withholdingTax: 0,
    invoiceTotal: amount,
    paymentMethod: "EFECTIVO",
  }
}

function capturedRow(invoice: AccountingCapturedSource): AccountingExportRow {
  return {
    number: 0,
    date: invoice.date,
    invoiceNumber: invoice.invoiceNumber,
    supplier: invoice.supplierOrCreditor,
    taxId: invoice.taxId,
    concept: invoice.concept,
    exemptBase: money(invoice.exemptBase),
    base21: money(invoice.base21),
    vat21: money(invoice.vat21),
    base10: money(invoice.base10),
    vat10: money(invoice.vat10),
    base4: money(invoice.base4),
    vat4: money(invoice.vat4),
    base2: money(invoice.base2),
    vat2: money(invoice.vat2),
    totalBase: money(invoice.totalBase),
    totalVat: money(invoice.totalVat),
    withholdingTax: money(invoice.withholdingTax),
    invoiceTotal: money(invoice.invoiceTotal),
    paymentMethod: invoice.paymentMethod,
  }
}

export function buildAccountingRows(sources: AccountingSources) {
  return [
    ...sources.invoices.map(invoiceRow),
    ...sources.expenses.map(expenseRow),
    ...sources.expensesLegacy.map(legacyExpenseRow),
  ]
    .sort((left, right) => left.date.getTime() - right.date.getTime() || left.supplier.localeCompare(right.supplier, "es"))
    .map((row, index) => ({ ...row, number: index + 1 }))
}

export function buildCapturedAccountingRows(invoices: AccountingCapturedSource[]) {
  return invoices
    .map(capturedRow)
    .sort((left, right) => left.date.getTime() - right.date.getTime() || left.supplier.localeCompare(right.supplier, "es"))
    .map((row, index) => ({ ...row, number: index + 1 }))
}

function rowValues(row: AccountingExportRow) {
  return [
    row.number,
    row.date,
    row.invoiceNumber,
    row.supplier,
    row.taxId,
    row.concept,
    row.exemptBase,
    row.base21,
    row.vat21,
    row.base10,
    row.vat10,
    row.base4,
    row.vat4,
    row.base2,
    row.vat2,
    row.totalBase,
    row.totalVat,
    row.withholdingTax,
    row.invoiceTotal,
    row.paymentMethod,
  ]
}

function totalValues(rows: AccountingExportRow[]) {
  const included = rows.filter((row) => !row.voided)
  const total = (selector: (row: AccountingExportRow) => number) => money(included.reduce((sum, row) => sum + selector(row), 0))
  return [
    "TOTAL",
    null,
    null,
    null,
    null,
    null,
    total((row) => row.exemptBase),
    total((row) => row.base21),
    total((row) => row.vat21),
    total((row) => row.base10),
    total((row) => row.vat10),
    total((row) => row.base4),
    total((row) => row.vat4),
    total((row) => row.base2),
    total((row) => row.vat2),
    total((row) => row.totalBase),
    total((row) => row.totalVat),
    total((row) => row.withholdingTax),
    total((row) => row.invoiceTotal),
    null,
  ]
}

export async function buildAccountingWorkbook(rows: AccountingExportRow[]) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Fans Cashflow"
  workbook.modified = new Date()

  const sheet = workbook.addWorksheet(ACCOUNTING_SHEET_NAME, {
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

  const header = sheet.addRow([...ACCOUNTING_HEADERS])
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
    to: { row: Math.max(1, rows.length + 1), column: ACCOUNTING_HEADERS.length },
  }
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  sheet.properties.defaultRowHeight = 20

  return workbook.xlsx.writeBuffer()
}
