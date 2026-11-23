import writeXlsxFile, { type CellObject, type SheetData } from "write-excel-file/node"
import { getCellAddress, getOrderOfSiblings, getSelfClosingTagMarkup, insertElementMarkupAccordingToOrderOfSiblings } from "write-excel-file/utility"
import { toN } from "@/lib/money"

export const ACCOUNTING_SHEET_NAME = "Gastos y Compras Fans"

export const ACCOUNTING_HEADERS = [
  "Nº",
  "Fecha",
  "Factura Nº",
  "Proveedor / Acreedor",
  "NIF",
  "ENTIDAD",
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
  "ORIGEN",
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
  entity?: string | null
  creditor: CreditorSource | null
  taxes: TaxSource[]
  applications: PaymentSource[]
  accountingInvoice?: { id: string } | null
}

export type AccountingExpenseSource = {
  entity?: string | null
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
  entity?: string | null
}

export type AccountingExportRow = {
  number: number
  date: Date
  invoiceNumber: string
  supplier: string
  taxId: string
  entity: string | null
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
  origin: string
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

const ENTITY_LABELS: Record<string, string> = {
  BAKERY: "Obrador",
  OBRADOR: "Obrador",
  COFFEE_SHOP: "Cafetería",
  CAFETERIA: "Cafetería",
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

function entityLabel(value: string | null | undefined) {
  return value ? ENTITY_LABELS[value] || value : ""
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
    entity: invoice.entity || null,
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
    origin: invoice.accountingInvoice ? "FACTURA OPERATIVA + GESTORÍA" : "FACTURA OPERATIVA",
    voided: invoice.workflowStatus === "VOID" || invoice.workflowStatus === "ANULADA",
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
    entity: expense.entity || null,
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
    origin: "GASTO CORRIENTE",
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
    entity: null,
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
    origin: "GASTO TURNO LEGACY",
  }
}

function capturedRow(invoice: AccountingCapturedSource): AccountingExportRow {
  return {
    number: 0,
    date: invoice.date,
    invoiceNumber: invoice.invoiceNumber,
    supplier: invoice.supplierOrCreditor,
    taxId: invoice.taxId,
    entity: invoice.entity || "BAKERY",
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
    origin: "CAPTURA GESTORÍA SIN VÍNCULO",
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
    entityLabel(row.entity),
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
    row.origin,
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
    null,
  ]
}

export async function buildAccountingWorkbook(rows: AccountingExportRow[]) {
  const widths = [8, 13, 18, 36, 16, 16, 18, ...Array.from({ length: 9 }, () => 17), 20, 19, 14, 18, 18, 30]
  const columns = widths.map((width) => ({ width }))
  const moneyFormat = "#,##0.00"
  const header = ACCOUNTING_HEADERS.map((value): CellObject => ({
    value,
    height: 34,
    fontWeight: "bold",
    textColor: "#FFFFFF",
    backgroundColor: "#1F4E78",
    align: "center",
    alignVertical: "center",
    wrap: true,
    bottomBorderStyle: "thin",
    bottomBorderColor: "#163A5C",
  }))
  const entries = rows.map((row, index) => rowValues(row).map((value, column): CellObject => ({
    value,
    alignVertical: "center",
    wrap: column >= 3 && column <= 6,
    backgroundColor: index % 2 === 1 ? "#F3F6F9" : undefined,
    format: column >= 7 && column <= 19 ? moneyFormat : undefined,
  })))
  const totals = totalValues(rows).map((value): CellObject => ({
    value: value ?? undefined,
    fontWeight: "bold",
    backgroundColor: "#D9EAF7",
    topBorderStyle: "medium",
    topBorderColor: "#1F4E78",
    format: typeof value === "number" ? moneyFormat : undefined,
  }))
  const data: SheetData = [header, ...entries, totals]

  const sheetFile = "xl/worksheets/sheet{id}.xml"
  const worksheetOrder = getOrderOfSiblings(sheetFile, "worksheet") ?? []
  // Preserve the filter (excluding totals) and the one-page-wide print layout.
  const filterRange = `A1:${getCellAddress(rows.length, ACCOUNTING_HEADERS.length - 1)}`
  const buffer = await writeXlsxFile(data, {
    sheet: ACCOUNTING_SHEET_NAME,
    columns,
    stickyRowsCount: 1,
    dateFormat: "dd/mm/yyyy",
    orientation: "landscape",
  }, {
    features: [{
      files: {
        transform: {
          [sheetFile]: {
            transformElementAttributes(tag, attributes) {
              return tag === "pageSetup" ? { ...attributes, fitToWidth: 1, fitToHeight: 0 } : attributes
            },
            transform(xml) {
              for (const element of [
                '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>',
                getSelfClosingTagMarkup("sheetFormatPr", { defaultRowHeight: 20 }),
                getSelfClosingTagMarkup("autoFilter", { ref: filterRange }),
              ]) {
                xml = insertElementMarkupAccordingToOrderOfSiblings(xml, element, worksheetOrder, "worksheet")
              }
              return xml
            },
          },
        },
      },
    }],
  }).toBuffer()
  return new Uint8Array(buffer)
}
