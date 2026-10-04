import { toN } from "@/lib/money"

export const SHIFT_TICKET_NUMERIC_FIELDS = [
  "grossSales",
  "refunds",
  "discounts",
  "netSales",
  "cashSales",
  "cardSales",
  "breadVat4Base",
  "breadVat4Amount",
  "vat10Base",
  "vat10Amount",
] as const

export type ShiftTicketNumericField = (typeof SHIFT_TICKET_NUMERIC_FIELDS)[number]

export interface ShiftTicketFields extends Record<ShiftTicketNumericField, string> {
  cashCloseNumber: string
  openingDateTime: string
  closingDateTime: string
}

export const EMPTY_SHIFT_TICKET_FIELDS: ShiftTicketFields = {
  cashCloseNumber: "",
  openingDateTime: "",
  closingDateTime: "",
  grossSales: "",
  refunds: "",
  discounts: "",
  netSales: "",
  cashSales: "",
  cardSales: "",
  breadVat4Base: "",
  breadVat4Amount: "",
  vat10Base: "",
  vat10Amount: "",
}

const SUMMARY_FIELDS = ["grossSales", "refunds", "discounts", "netSales", "cashSales", "cardSales"] as const
const TAX_FIELDS = ["breadVat4Base", "breadVat4Amount", "vat10Base", "vat10Amount"] as const

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/(^|\s)[|l]va(?=\s|,)/g, "$1iva")
    .trim()
}

function parseAmount(value: string) {
  const cleaned = value.replace(/[^0-9,.-]/g, "").replace(/\.(?=.*\.)/g, "")
  if (!cleaned) return ""
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount.toFixed(2) : ""
}

function amountTokens(value: string) {
  return value.match(/[-+]?\d[\d.\s]*(?:,\d+)?/g) || []
}

function currencyValues(lines: string[], start: number, end = lines.length) {
  const values: string[] = []
  for (const line of lines.slice(start, end)) {
    const matches = line.match(/€\s*[-+]?\d[\d.\s]*(?:,\d+)?|[-+]?\d[\d.\s]*,\d{2}/g) || []
    values.push(...matches)
  }
  return values.map((value) => parseAmount(value)).filter(Boolean)
}

function amountFromLabel(lines: string[], label: string, start = 0, end = lines.length) {
  const wanted = normalizeText(label)
  for (let index = start; index < end; index += 1) {
    const normalizedLine = normalizeText(lines[index])
    const labelIndex = normalizedLine.indexOf(wanted)
    if (labelIndex < 0) continue

    const sameLine = amountTokens(lines[index].slice(labelIndex + wanted.length))
    if (sameLine.length > 0) return parseAmount(sameLine[sameLine.length - 1])

    for (let next = index + 1; next < Math.min(index + 3, end); next += 1) {
      const nextTokens = amountTokens(lines[next])
      if (nextTokens.length > 0) return parseAmount(nextTokens[nextTokens.length - 1])
    }
    return ""
  }
  return ""
}

function dateTimeFromLabel(lines: string[], label: string) {
  const wanted = normalizeText(label)
  const datePattern = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\s+(\d{1,2})[:.](\d{2})/

  for (let index = 0; index < lines.length; index += 1) {
    if (!normalizeText(lines[index]).includes(wanted)) continue
    const block = lines.slice(index, index + 3).join(" ")
    const match = block.match(datePattern)
    if (!match) return ""
    const [, day, month, rawYear, hour, minute] = match
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}`
  }
  return ""
}

function textAfterLabel(lines: string[], label: string) {
  const wanted = normalizeText(label)
  for (const line of lines) {
    const normalizedLine = normalizeText(line)
    const index = normalizedLine.indexOf(wanted)
    if (index < 0) continue
    const value = line.slice(index + label.length).replace(/^\s*[:\-]\s*/, "").trim()
    if (value) return value.replace(/[|]/g, "").trim()
  }
  return ""
}

function closeNumberFromLines(lines: string[]) {
  for (const line of lines) {
    if (!normalizeText(line).includes("numero de cierre de caja")) continue
    const values = line.match(/\d+/g)
    if (values?.length) return values[values.length - 1]
  }
  return ""
}

function near(first: number, second: number, tolerance = 0.05) {
  return Math.abs(first - second) <= tolerance
}

function inferSummary(values: string[]) {
  let best: { values: string[], score: number } | null = null
  for (let index = 0; index <= values.length - SUMMARY_FIELDS.length; index += 1) {
    const candidate = values.slice(index, index + SUMMARY_FIELDS.length)
    const [gross, refunds, discounts, net, cash, card] = candidate.map(toN)
    if (gross <= 0 || net <= 0) continue
    if (!near(gross - refunds - discounts, net)) continue
    if (!near(cash + card, net)) continue
    const score = index + (gross === net ? 2 : 0)
    if (!best || score > best.score) best = { values: candidate, score }
  }
  return best?.values || []
}

function inferTaxes(values: string[], summary: string[]) {
  const summaryStart = summary.length > 0
    ? values.findIndex((value, index) => summary.every((item, offset) => values[index + offset] === item))
    : -1
  const searchFrom = summaryStart >= 0 ? summaryStart + summary.length : 0
  for (let index = searchFrom; index <= values.length - TAX_FIELDS.length; index += 1) {
    const candidate = values.slice(index, index + TAX_FIELDS.length)
    const [base4, amount4, base10, amount10] = candidate.map(toN)
    if (base4 < 0 || amount4 < 0 || base10 <= 0 || amount10 <= 0) continue
    if (!near(base4 * 0.04, amount4)) continue
    if (!near(base10 * 0.1, amount10)) continue
    return candidate
  }
  return []
}

export function extractShiftTicket(text: string): ShiftTicketFields {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const normalizedLines = lines.map(normalizeText)
  const summaryStart = normalizedLines.findIndex((line) => line.includes("resumen de ventas"))
  const salesLabelsStart = normalizedLines.findIndex((line) => line.includes("ventas brutas"))
  const taxesStart = normalizedLines.findIndex((line) => line === "impuestos" || line.includes("impuestos"))
  const taxLabelsStart = normalizedLines.findIndex((line) => /iva.*(?:4|10)%/.test(line))
  const summaryFrom = summaryStart >= 0 ? summaryStart : salesLabelsStart >= 0 ? salesLabelsStart : lines.length
  const summaryTo = taxesStart > summaryFrom ? taxesStart : lines.length
  const taxesFrom = taxesStart >= 0 ? taxesStart : taxLabelsStart >= 0 ? taxLabelsStart : lines.length
  const fields = { ...EMPTY_SHIFT_TICKET_FIELDS }

  fields.cashCloseNumber = closeNumberFromLines(lines) || textAfterLabel(lines, "Número de cierre de caja") || textAfterLabel(lines, "Numero de cierre de caja")
  fields.openingDateTime = dateTimeFromLabel(lines, "Apertura del turno")
  fields.closingDateTime = dateTimeFromLabel(lines, "Cerrado")

  fields.grossSales = amountFromLabel(lines, "Ventas brutas", summaryFrom, summaryTo)
  fields.refunds = amountFromLabel(lines, "Reembolsos", summaryFrom, summaryTo)
  fields.discounts = amountFromLabel(lines, "Descuentos", summaryFrom, summaryTo)
  fields.netSales = amountFromLabel(lines, "Ventas netas", summaryFrom, summaryTo)
  fields.cashSales = amountFromLabel(lines, "Efectivo", summaryFrom, summaryTo)
  fields.cardSales = amountFromLabel(lines, "Por tarjeta", summaryFrom, summaryTo)

  if (summaryStart >= 0) {
    const summaryValues = currencyValues(lines, summaryFrom, summaryTo)
    if (summaryValues.length >= SUMMARY_FIELDS.length) {
      SUMMARY_FIELDS.forEach((field, index) => { fields[field] = summaryValues[index] })
    }
  }

  fields.breadVat4Base = amountFromLabel(lines, "IVA Pan, 4% base imp", taxesFrom)
  fields.breadVat4Amount = amountFromLabel(lines, "IVA Pan, 4% cuota", taxesFrom)
  fields.vat10Base = amountFromLabel(lines, "IVA, 10% base imp", taxesFrom)
  fields.vat10Amount = amountFromLabel(lines, "IVA, 10% cuota", taxesFrom)

  if (taxesStart >= 0) {
    const taxValues = currencyValues(lines, taxesFrom)
    if (taxValues.length >= TAX_FIELDS.length) {
      TAX_FIELDS.forEach((field, index) => { fields[field] = taxValues[index] })
    } else if (taxValues.length === 2) {
      ;[fields.vat10Base, fields.vat10Amount] = taxValues
    }
  }

  const allValues = currencyValues(lines, 0)
  const inferredSummary = inferSummary(allValues)
  if (inferredSummary.length === SUMMARY_FIELDS.length) {
    SUMMARY_FIELDS.forEach((field, index) => {
      if (fields[field] === "") fields[field] = inferredSummary[index]
    })
  }
  const inferredTaxes = inferTaxes(allValues, inferredSummary)
  if (inferredTaxes.length === TAX_FIELDS.length) {
    TAX_FIELDS.forEach((field, index) => {
      if (fields[field] === "") fields[field] = inferredTaxes[index]
    })
  }

  return fields
}

function summaryScore(fields: ShiftTicketFields) {
  const completeness = SUMMARY_FIELDS.filter((field) => fields[field] !== "").length * 2
  const hasSalesBalance = ["grossSales", "refunds", "discounts", "netSales"].every((field) => fields[field as ShiftTicketNumericField] !== "")
  const hasPaymentBalance = ["cashSales", "cardSales", "netSales"].every((field) => fields[field as ShiftTicketNumericField] !== "")
  const salesBalance = hasSalesBalance && Math.abs(toN(fields.grossSales) - toN(fields.refunds) - toN(fields.discounts) - toN(fields.netSales)) <= 0.03 ? 3 : 0
  const paymentBalance = hasPaymentBalance && Math.abs(toN(fields.cashSales) + toN(fields.cardSales) - toN(fields.netSales)) <= 0.03 ? 3 : 0
  return completeness + salesBalance + paymentBalance
}

function taxScore(fields: ShiftTicketFields) {
  const completeness = TAX_FIELDS.filter((field) => fields[field] !== "").length * 2
  const breadBalance = fields.breadVat4Base !== "" && fields.breadVat4Amount !== "" && Math.abs(toN(fields.breadVat4Base) * 0.04 - toN(fields.breadVat4Amount)) <= 0.05 ? 2 : 0
  const vat10Balance = fields.vat10Base !== "" && fields.vat10Amount !== "" && Math.abs(toN(fields.vat10Base) * 0.1 - toN(fields.vat10Amount)) <= 0.05 ? 2 : 0
  return completeness + breadBalance + vat10Balance
}

function mergeSection(
  merged: ShiftTicketFields,
  preferred: ShiftTicketFields,
  fallback: ShiftTicketFields,
  fields: readonly ShiftTicketNumericField[],
) {
  for (const field of fields) merged[field] = preferred[field] !== "" ? preferred[field] : fallback[field]
}

export function mergeShiftTicketReadings(first: ShiftTicketFields, second: ShiftTicketFields) {
  const merged = { ...EMPTY_SHIFT_TICKET_FIELDS }
  const summaryFirst = summaryScore(first) >= summaryScore(second)
  const taxFirst = taxScore(first) >= taxScore(second)
  mergeSection(merged, summaryFirst ? first : second, summaryFirst ? second : first, SUMMARY_FIELDS)
  mergeSection(merged, taxFirst ? first : second, taxFirst ? second : first, TAX_FIELDS)

  for (const field of ["cashCloseNumber", "openingDateTime", "closingDateTime"] as const) {
    merged[field] = first[field].trim() ? first[field] : second[field]
  }
  return merged
}

async function createTicketCrop(file: File, startFraction: number) {
  const image = new Image()
  const objectUrl = URL.createObjectURL(file)
  try {
    image.src = objectUrl
    await image.decode()
    const sourceY = Math.floor(image.naturalHeight * startFraction)
    const sourceHeight = image.naturalHeight - sourceY
    const canvas = document.createElement("canvas")
    canvas.width = image.naturalWidth
    canvas.height = sourceHeight
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas no disponible")
    context.drawImage(image, 0, sourceY, image.naturalWidth, sourceHeight, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function createLowerTicketCrop(file: File) {
  return createTicketCrop(file, 0.38)
}

export function createTaxTicketCrop(file: File) {
  return createTicketCrop(file, 0.65)
}
