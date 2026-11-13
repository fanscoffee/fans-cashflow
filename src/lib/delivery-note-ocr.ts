export interface DeliveryNoteLineDraft {
  description: string
  quantity: string
  lineTotal: string
}

export interface DeliveryNoteTaxDraft {
  percentage: string
  taxableBase: string
  taxAmount: string
}

export interface DeliveryNoteDraft {
  supplierName: string
  supplierTaxId: string
  deliveryNoteCode: string
  receivedAt: string
  preparationGross: string
  totalAmount: string
  taxes: DeliveryNoteTaxDraft[]
  lines: DeliveryNoteLineDraft[]
  warnings: string[]
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
}

function normalizeTaxId(value: string) {
  return value.replace(/[\s./-]/g, "").toUpperCase()
}

function spanishNumber(value: string) {
  const compact = value.replace(/\s/g, "")
  const normalized = compact.includes(",") ? compact.replace(/\./g, "").replace(",", ".") : compact
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function money(value: string) {
  return spanishNumber(value).toFixed(2)
}

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (value === null || value === undefined || value === "") return null
  const parsed = spanishNumber(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

function vatValue(value: unknown) {
  const parsed = numberValue(value)
  return parsed !== null && parsed !== -100 ? parsed : null
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function dateFromText(value: string) {
  const match = value.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/)
  if (!match) return ""
  const year = match[3].length === 2 ? `20${match[3]}` : match[3]
  return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`
}

function supplierTaxId(lines: string[]) {
  const line = lines.find((value) => /mercadona\s*\.?\s*s\s*\.?\s*a\b/i.test(value) && /\b[A-Z]\s*[-–]?\s*\d{8}\b/i.test(value))
    || lines.find((value) => /\b[A-Z]\s*[-–]?\s*\d{8}\b/i.test(value))
    || ""
  const match = line.match(/\b([A-Z])\s*[-–]?\s*(\d{8})\b/i)
  return match ? normalizeTaxId(`${match[1]}${match[2]}`) : ""
}

function supplierName(lines: string[]) {
  const line = lines.find((value) => /mercadona\s*\.?\s*s\s*\.?\s*a\b/i.test(value) && /\b[A-Z]\s*[-–]?\s*\d{8}\b/i.test(value))
    || lines.find((value) => /mercadona\s*\.?\s*s\s*\.?\s*a\b/i.test(value))
    || ""
  if (!line) return ""
  return line.split("|")[0].trim().replace(/[.,]+$/, "")
}

function parseProductLine(value: string) {
  const match = value.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))\s*€?$/)
  if (!match) return null
  const description = match[1].trim()
  if (description.length < 2 || /^(?:nombre producto|productos?|total|iva|base|cuota|coste)/i.test(description)) return null
  return {
    description,
    quantity: spanishNumber(match[2]).toString(),
    lineTotal: money(match[3]),
  }
}

function parseSplitProductLine(descriptionLine: string, valueLine: string) {
  const valueMatch = valueLine.match(/^\s*(\d+(?:[.,]\d+)?)\s+(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))\s*€?\s*$/)
  if (!valueMatch) return null
  return parseProductLine(`${descriptionLine.trim()} ${valueMatch[1]} ${valueMatch[2]}`)
}

function isPossibleSplitProductDescription(value: string) {
  const normalized = normalizeText(value)
  return Boolean(normalized)
    && !/^(?:-|nombre producto|productos?|total|iva|base|cuota|coste|desglose|mercadona|pedido|factura|entrega|cobrado|calle|en caso|condiciones)/i.test(normalized)
    && !/\d/.test(normalized)
}

function parseProductLines(lines: string[]) {
  const parsed: DeliveryNoteLineDraft[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const direct = parseProductLine(lines[index])
    if (direct) {
      parsed.push(direct)
      continue
    }
    if (index + 1 >= lines.length || !isPossibleSplitProductDescription(lines[index])) continue
    const split = parseSplitProductLine(lines[index], lines[index + 1])
    if (!split) continue
    parsed.push(split)
    index += 1
  }
  return parsed
}

function addTaxRow(rows: DeliveryNoteTaxDraft[], percentage: number, taxableBase: string, taxAmount: string) {
  const normalizedPercentage = percentage.toFixed(2)
  const existing = rows.find((row) => row.percentage === normalizedPercentage)
  if (!existing) {
    rows.push({
      percentage: normalizedPercentage,
      taxableBase: money(taxableBase),
      taxAmount: money(taxAmount),
    })
    return
  }
  existing.taxableBase = round(spanishNumber(existing.taxableBase) + spanishNumber(taxableBase)).toFixed(2)
  existing.taxAmount = round(spanishNumber(existing.taxAmount) + spanishNumber(taxAmount)).toFixed(2)
}

function parseTaxRows(lines: string[]) {
  const headerIndex = lines.findIndex((line) => normalizeText(line).includes("desglose de impuestos"))
  if (headerIndex < 0) return []

  const rows: DeliveryNoteTaxDraft[] = []
  let pendingPercentage: number | null = null
  let pendingValues: string[] = []
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    const normalized = normalizeText(line)
    if (/^total\b/.test(normalized) || /mercadona/i.test(line)) break

    const rateMatch = line.match(/^\s*(\d+(?:[.,]\d+)?)\s*%/)
    if (rateMatch) {
      pendingPercentage = Number(rateMatch[1].replace(",", "."))
      pendingValues = line.slice((rateMatch.index || 0) + rateMatch[0].length).match(/\d+(?:[.,]\d+)?/g) || []
      if (pendingValues.length >= 2 && Number.isFinite(pendingPercentage)) {
        addTaxRow(rows, pendingPercentage, pendingValues[0] || "0", pendingValues[1] || "0")
        pendingPercentage = null
        pendingValues = []
      }
      continue
    }

    if (pendingPercentage === null) continue
    const values = line.match(/\d+(?:[.,]\d+)?/g) || []
    pendingValues.push(...values)
    if (pendingValues.length >= 2) {
      addTaxRow(rows, pendingPercentage, pendingValues[0] || "0", pendingValues[1] || "0")
      pendingPercentage = null
      pendingValues = []
    }
  }

  return rows.sort((left, right) => Number(left.percentage) - Number(right.percentage))
}

export function parseDeliveryNoteText(text: string): DeliveryNoteDraft {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const normalizedLines = lines.map(normalizeText)
  const warnings: string[] = []
  const orderMatch = text.match(/\bPedido\s*(?:N[º°o]\.?|#)?\s*([A-Z0-9-]{5,})\b/i)
  const deliveryNoteCode = orderMatch?.[1]?.trim() || ""
  const dateLine = lines.find((line) => /\bcobrado\s+el\b/i.test(line)) || lines.find((line) => /\bentrega\b/i.test(line)) || ""
  const receivedAt = dateFromText(dateLine)
  const preparationLine = lines.find((line) => /coste\s+de\s+preparaci[oó]n/i.test(line)) || ""
  const preparationMatch = preparationLine.match(/coste\s+de\s+preparaci[oó]n\s+([\d.,]+)/i)
  const totalLine = lines.find((line) => /^total\b/i.test(normalizeText(line))) || ""
  const totalMatch = totalLine.match(/\btotal\s+([\d.,]+)\s*€?/i)
  const headerIndex = normalizedLines.findIndex((line) => line.includes("nombre producto") && line.includes("cantidad entregada") && line.includes("pvp"))
  const endIndex = headerIndex >= 0
    ? normalizedLines.slice(headerIndex + 1).findIndex((line) => /^productos?\b/.test(line))
    : -1
  const productLines = headerIndex >= 0
    ? lines.slice(headerIndex + 1, endIndex >= 0 ? headerIndex + 1 + endIndex : undefined)
    : lines
  const parsedLines = parseProductLines(productLines)
  const taxes = parseTaxRows(lines)

  if (!supplierName(lines)) warnings.push("No se pudo identificar el proveedor")
  if (!supplierTaxId(lines)) warnings.push("No se pudo identificar el NIF del proveedor")
  if (!deliveryNoteCode) warnings.push("No se pudo identificar el número de pedido/albarán")
  if (!receivedAt) warnings.push("No se pudo identificar la fecha de entrega")
  if (!parsedLines.length) warnings.push("No se encontraron líneas de producto")

  return {
    supplierName: supplierName(lines),
    supplierTaxId: supplierTaxId(lines),
    deliveryNoteCode,
    receivedAt,
    preparationGross: preparationMatch ? money(preparationMatch[1]) : "0.00",
    totalAmount: totalMatch ? money(totalMatch[1]) : "0.00",
    taxes,
    lines: parsedLines,
    warnings,
  }
}

export function normalizeDeliveryProduct(value: string) {
  return normalizeText(value).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()
}

export function matchDeliveryProduct<T extends { id: string; code: string; posDescription: string }>(description: string, products: T[]) {
  const target = normalizeDeliveryProduct(description)
  if (!target) return null

  const exact = products.find((product) => normalizeDeliveryProduct(product.posDescription) === target)
  if (exact) return exact

  const targetTokens = new Set(target.split(" ").filter((token) => token.length >= 3))
  if (!targetTokens.size) return null
  const scored = products.map((product) => {
    const candidate = normalizeDeliveryProduct(product.posDescription)
    const candidateTokens = new Set(candidate.split(" ").filter((token) => token.length >= 3))
    const common = Array.from(targetTokens).filter((token) => candidateTokens.has(token)).length
    const targetCoverage = common / targetTokens.size
    const candidateCoverage = candidateTokens.size ? common / candidateTokens.size : 0
    const contains = target.includes(candidate) || candidate.includes(target)
    return { product, score: contains ? 1 : Math.min(targetCoverage, candidateCoverage) }
  }).sort((left, right) => right.score - left.score)

  return scored[0] && scored[0].score >= 0.78 && (scored.length === 1 || scored[0].score - scored[1].score >= 0.08)
    ? scored[0].product
    : null
}

export function grossLineTotalToNetUnitPrice(lineTotal: string | number, quantity: string | number, vatPercentage: string | number | null | undefined) {
  const total = numberValue(lineTotal) ?? 0
  const units = numberValue(quantity) ?? 0
  if (!Number.isFinite(total) || !Number.isFinite(units) || units <= 0) return 0
  const vat = vatValue(vatPercentage) ?? 0
  const net = vat !== -100 ? total / units / (1 + vat / 100) : total / units
  return round(net, 4)
}

export function grossAmountToNet(amount: string | number, vatPercentage: string | number | null | undefined) {
  const gross = numberValue(amount)
  const vat = vatValue(vatPercentage)
  if (gross === null || vat === null) return null
  return round(gross / (1 + vat / 100), 4)
}

export interface DeliveryNoteFiscalLine {
  quantity: string | number
  netUnitPrice: string | number
  vatPercentage: string | number | null | undefined
  grossLineTotal?: string | number | null
}

export interface DeliveryNoteFiscalValidation {
  valid: boolean
  unknownVatLineIndexes: number[]
  preparationVatPercentage: number | null
  preparationNet: number | null
  calculatedTaxes: DeliveryNoteTaxDraft[]
  warnings: string[]
}

export function validateDeliveryNoteFiscalBreakdown(input: {
  lines: DeliveryNoteFiscalLine[]
  taxes: DeliveryNoteTaxDraft[]
  preparationGross: string | number | null | undefined
  preparationNet?: string | number | null
  totalGross?: string | number | null
  tolerance?: number
}): DeliveryNoteFiscalValidation {
  const tolerance = input.tolerance ?? 0.05
  const buckets = new Map<number, { taxableBase: number; taxAmount: number }>()
  const unknownVatLineIndexes: number[] = []
  const warnings: string[] = []

  const addBucket = (percentage: number, taxableBase: number, taxAmount: number) => {
    const current = buckets.get(percentage) || { taxableBase: 0, taxAmount: 0 }
    current.taxableBase += taxableBase
    current.taxAmount += taxAmount
    buckets.set(percentage, current)
  }

  input.lines.forEach((line, index) => {
    const quantity = numberValue(line.quantity) ?? 0
    const netUnitPrice = numberValue(line.netUnitPrice) ?? 0
    const vat = vatValue(line.vatPercentage)
    if (vat === null) {
      unknownVatLineIndexes.push(index)
      return
    }

    const taxableBase = round(quantity * netUnitPrice)
    const taxAmount = round(taxableBase * vat / 100)
    addBucket(vat, taxableBase, taxAmount)

    const grossLineTotal = numberValue(line.grossLineTotal)
    if (grossLineTotal !== null && Math.abs(taxableBase + taxAmount - grossLineTotal) > tolerance) {
      warnings.push(`La línea ${index + 1} no coincide con el PVP bruto del albarán`)
    }
  })

  const preparationGross = numberValue(input.preparationGross) ?? 0
  const preparationVatPercentage = input.taxes.some((tax) => Number(tax.percentage) === 21) ? 21 : null
  const preparationNet = preparationGross > 0 && preparationVatPercentage !== null
    ? grossAmountToNet(preparationGross, preparationVatPercentage)
    : preparationGross > 0 ? null : 0
  const enteredPreparationNet = numberValue(input.preparationNet)

  if (preparationGross > 0 && preparationVatPercentage === null) {
    warnings.push("No se pudo confirmar el IVA del coste de preparación")
  } else if (preparationNet !== null && preparationVatPercentage !== null) {
    if (enteredPreparationNet !== null && Math.abs(enteredPreparationNet - preparationNet) > 0.0001) {
      warnings.push(`El coste de preparación sin IVA no coincide (${enteredPreparationNet.toFixed(4)} € / ${preparationNet.toFixed(4)} €)`)
    }
    const base = round(enteredPreparationNet ?? preparationNet)
    addBucket(preparationVatPercentage, base, round(base * preparationVatPercentage / 100))
  }

  if (unknownVatLineIndexes.length > 0) {
    warnings.push(`IVA desconocido en ${unknownVatLineIndexes.length} línea${unknownVatLineIndexes.length === 1 ? "" : "s"}`)
  }

  const expected = new Map<number, { taxableBase: number; taxAmount: number }>()
  for (const tax of input.taxes) {
    const percentage = numberValue(tax.percentage)
    if (percentage === null) continue
    expected.set(percentage, {
      taxableBase: numberValue(tax.taxableBase) ?? 0,
      taxAmount: numberValue(tax.taxAmount) ?? 0,
    })
  }

  const percentages = new Set([...expected.keys(), ...buckets.keys()])
  for (const percentage of percentages) {
    const calculated = buckets.get(percentage) || { taxableBase: 0, taxAmount: 0 }
    const expectedValues = expected.get(percentage) || { taxableBase: 0, taxAmount: 0 }
    const baseDifference = Math.abs(round(calculated.taxableBase) - round(expectedValues.taxableBase))
    const taxDifference = Math.abs(round(calculated.taxAmount) - round(expectedValues.taxAmount))
    if (baseDifference > tolerance || taxDifference > tolerance) {
      warnings.push(`El desglose de IVA del ${percentage}% no coincide (base ${round(calculated.taxableBase).toFixed(2)} € / ${round(expectedValues.taxableBase).toFixed(2)} €, cuota ${round(calculated.taxAmount).toFixed(2)} € / ${round(expectedValues.taxAmount).toFixed(2)} €)`)
    }
  }

  const calculatedGross = Array.from(buckets.values()).reduce((sum, bucket) => sum + round(bucket.taxableBase) + round(bucket.taxAmount), 0)
  const totalGross = numberValue(input.totalGross)
  if (totalGross !== null && Math.abs(round(calculatedGross) - round(totalGross)) > tolerance) {
    warnings.push(`El total calculado no coincide con el total bruto del albarán (${round(calculatedGross).toFixed(2)} € / ${round(totalGross).toFixed(2)} €)`)
  }

  const calculatedTaxes = Array.from(buckets.entries())
    .sort(([left], [right]) => left - right)
    .map(([percentage, bucket]) => ({
      percentage: percentage.toFixed(2),
      taxableBase: round(bucket.taxableBase).toFixed(2),
      taxAmount: round(bucket.taxAmount).toFixed(2),
    }))

  return {
    valid: warnings.length === 0,
    unknownVatLineIndexes,
    preparationVatPercentage,
    preparationNet,
    calculatedTaxes,
    warnings: Array.from(new Set(warnings)),
  }
}
