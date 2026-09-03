import { z } from "zod"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"
import { normalizeTaxId } from "@/lib/invoices"
import { toN } from "@/lib/money"
import type { InvoiceDraft } from "@/lib/invoice-ocr"

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

export const accountingInvoiceSchema = z.object({
  date: dateOnly,
  invoiceNumber: z.string().trim().max(120).default(""),
  supplierOrCreditor: z.string().trim().max(255).default(""),
  taxId: z.string().trim().max(64).default(""),
  concept: z.string().trim().max(160).default(""),
  exemptBase: money,
  base21: money,
  vat21: money,
  base10: money,
  vat10: money,
  base4: money,
  vat4: money,
  base2: money,
  vat2: money,
  totalBase: money,
  totalVat: money,
  withholdingTax: money,
  invoiceTotal: requiredMoney,
  paymentMethod: z.string().trim().max(80).default(""),
  ocrText: z.string().max(500_000).default(""),
  source: z.enum(["OCR", "MANUAL"]).default("MANUAL"),
})

export type AccountingInvoiceInput = z.infer<typeof accountingInvoiceSchema>

export const ACCOUNTING_ROLES = [UserRole.ADMIN, UserRole.PARTNER] as const

export function canAccessAccounting(role: string) {
  return hasAnyRole(role, ACCOUNTING_ROLES)
}

export interface AccountingInvoiceFormData {
  date: string
  invoiceNumber: string
  supplierOrCreditor: string
  taxId: string
  concept: string
  exemptBase: string
  base21: string
  vat21: string
  base10: string
  vat10: string
  base4: string
  vat4: string
  base2: string
  vat2: string
  totalBase: string
  totalVat: string
  withholdingTax: string
  invoiceTotal: string
  paymentMethod: string
  ocrText: string
  source: "OCR" | "MANUAL"
}

function textMoney(value: unknown) {
  return toN(value).toFixed(2)
}

export function emptyAccountingInvoice(): AccountingInvoiceFormData {
  return {
    date: "",
    invoiceNumber: "",
    supplierOrCreditor: "",
    taxId: "",
    concept: "",
    exemptBase: "0.00",
    base21: "0.00",
    vat21: "0.00",
    base10: "0.00",
    vat10: "0.00",
    base4: "0.00",
    vat4: "0.00",
    base2: "0.00",
    vat2: "0.00",
    totalBase: "0.00",
    totalVat: "0.00",
    withholdingTax: "0.00",
    invoiceTotal: "",
    paymentMethod: "",
    ocrText: "",
    source: "MANUAL",
  }
}

export function invoiceDraftToAccounting(draft: InvoiceDraft, ocrText: string): AccountingInvoiceFormData {
  const form = emptyAccountingInvoice()
  const taxes = {
    exemptBase: 0,
    base21: 0,
    vat21: 0,
    base10: 0,
    vat10: 0,
    base4: 0,
    vat4: 0,
    base2: 0,
    vat2: 0,
    withholdingTax: 0,
  }

  for (const tax of draft.taxes) {
    const percentage = Math.round(toN(tax.percentage) * 100) / 100
    const base = toN(tax.taxableBase)
    const quota = toN(tax.taxAmount)
    if (tax.type === "IRPF") {
      taxes.withholdingTax += quota
    } else if (tax.type === "IVA") {
      if (percentage === 21) { taxes.base21 += base; taxes.vat21 += quota }
      if (percentage === 10) { taxes.base10 += base; taxes.vat10 += quota }
      if (percentage === 4) { taxes.base4 += base; taxes.vat4 += quota }
      if (percentage === 2) { taxes.base2 += base; taxes.vat2 += quota }
      if (percentage === 0) taxes.exemptBase += base
    }
  }

  const totalBase = toN(draft.netTotal) || taxes.base21 + taxes.base10 + taxes.base4 + taxes.base2 + taxes.exemptBase
  const totalVat = toN(draft.totalVat) || taxes.vat21 + taxes.vat10 + taxes.vat4 + taxes.vat2
  const withholdingTax = toN(draft.withholdingTotal) || taxes.withholdingTax
  const hasTaxRows = draft.taxes.length > 0
  const exemptBase = taxes.exemptBase || (!hasTaxRows ? totalBase : 0)

  return {
    ...form,
    date: draft.issueDate,
    invoiceNumber: [draft.series, draft.number].filter(Boolean).join("/"),
    supplierOrCreditor: draft.issuerLegalName.trim(),
    taxId: draft.issuerTaxId,
    concept: draft.lines.some((line) => line.description.trim()) ? "COMPRA" : "GASTO",
    exemptBase: textMoney(exemptBase),
    base21: textMoney(taxes.base21),
    vat21: textMoney(taxes.vat21),
    base10: textMoney(taxes.base10),
    vat10: textMoney(taxes.vat10),
    base4: textMoney(taxes.base4),
    vat4: textMoney(taxes.vat4),
    base2: textMoney(taxes.base2),
    vat2: textMoney(taxes.vat2),
    totalBase: textMoney(totalBase),
    totalVat: textMoney(totalVat),
    withholdingTax: textMoney(withholdingTax),
    invoiceTotal: toN(draft.totalAmount) > 0 ? textMoney(draft.totalAmount) : "",
    paymentMethod: draft.paymentMethod,
    ocrText,
    source: "OCR",
  }
}

export function normalizeAccountingTaxId(value: string) {
  return normalizeTaxId(value)
}

export function normalizeAccountingInvoiceNumber(value: string) {
  return value.trim().toUpperCase()
}

export function accountingDbData(input: AccountingInvoiceInput, createdById: string, alerts: string[]) {
  return {
    date: new Date(`${input.date}T00:00:00.000Z`),
    invoiceNumber: normalizeAccountingInvoiceNumber(input.invoiceNumber),
    supplierOrCreditor: input.supplierOrCreditor,
    taxId: normalizeAccountingTaxId(input.taxId),
    concept: input.concept,
    exemptBase: input.exemptBase,
    base21: input.base21,
    vat21: input.vat21,
    base10: input.base10,
    vat10: input.vat10,
    base4: input.base4,
    vat4: input.vat4,
    base2: input.base2,
    vat2: input.vat2,
    totalBase: input.totalBase,
    totalVat: input.totalVat,
    withholdingTax: input.withholdingTax,
    invoiceTotal: input.invoiceTotal,
    paymentMethod: input.paymentMethod,
    ocrText: input.ocrText || null,
    source: input.source,
    alerts: alerts.length ? alerts : undefined,
    createdById,
  }
}

export function buildAccountingAmountWarnings(input: Pick<AccountingInvoiceInput, "exemptBase" | "base21" | "base10" | "base4" | "base2" | "totalBase" | "totalVat" | "withholdingTax" | "invoiceTotal">) {
  const hasBreakdown = input.totalBase > 0 || input.totalVat > 0 || input.withholdingTax > 0
  if (!hasBreakdown) return []

  const expected = input.totalBase + input.totalVat - input.withholdingTax
  if (Math.abs(expected - input.invoiceTotal) <= 0.02) return []
  return [`Importes no cuadran: base ${input.totalBase.toFixed(2)} + IVA ${input.totalVat.toFixed(2)} - IRPF ${input.withholdingTax.toFixed(2)} != total ${input.invoiceTotal.toFixed(2)}`]
}
