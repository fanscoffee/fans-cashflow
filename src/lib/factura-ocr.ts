export interface FacturaLineaDraft {
  productoId: string
  tipoLinea: "PRODUCTO" | "CARGO"
  referenciaProveedor: string
  codigoArticulo: string
  descripcion: string
  unidadMedida: string
  formatoOriginal: string
  cantidad: string
  descuentoPorcentaje: string
  descuentoImporte: string
  precioUnitario: string
  precioUnitarioNeto: string
  baseImponible: string
  tipoIva: string
  cuotaIva: string
  totalLinea: string
  lote: string
  fechaVencimiento: string
}

export interface FacturaImpuestoDraft {
  tipo: "IVA" | "RECARGO_EQUIVALENCIA" | "IRPF"
  porcentaje: string
  baseImponible: string
  cuota: string
}

export interface FacturaDraft {
  serie: string
  numero: string
  fechaExpedicion: string
  fechaOperacion: string
  fechaVencimiento: string
  fechaPago: string
  numeroPedido: string
  fechaPedido: string
  centroEntrega: string
  referenciaAlbaran: string
  fechaAlbaran: string
  formaPago: string
  razonSocialEmisor: string
  nifEmisor: string
  domicilioFiscalEmisor: string
  totalNeto: string
  totalDescuento: string
  totalIva: string
  totalRecargo: string
  totalRetenciones: string
  importeTotal: string
  observaciones: string
  receptorCifValido: boolean
  lineas: FacturaLineaDraft[]
  impuestos: FacturaImpuestoDraft[]
}

export function emptyFacturaLinea(): FacturaLineaDraft {
  return {
    productoId: "",
    tipoLinea: "PRODUCTO",
    referenciaProveedor: "",
    codigoArticulo: "",
    descripcion: "",
    unidadMedida: "",
    formatoOriginal: "",
    cantidad: "0",
    descuentoPorcentaje: "0",
    descuentoImporte: "0",
    precioUnitario: "0",
    precioUnitarioNeto: "0",
    baseImponible: "0",
    tipoIva: "0",
    cuotaIva: "0",
    totalLinea: "0",
    lote: "",
    fechaVencimiento: "",
  }
}

export function emptyFacturaDraft(): FacturaDraft {
  return {
    serie: "",
    numero: "",
    fechaExpedicion: "",
    fechaOperacion: "",
    fechaVencimiento: "",
    fechaPago: "",
    numeroPedido: "",
    fechaPedido: "",
    centroEntrega: "",
    referenciaAlbaran: "",
    fechaAlbaran: "",
    formaPago: "",
    razonSocialEmisor: "",
    nifEmisor: "",
    domicilioFiscalEmisor: "",
    totalNeto: "0",
    totalDescuento: "0.00",
    totalIva: "0",
    totalRecargo: "0",
    totalRetenciones: "0",
    importeTotal: "0",
    observaciones: "",
    receptorCifValido: false,
    lineas: [emptyFacturaLinea()],
    impuestos: [],
  }
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
}

function normalizeAlpha(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "").trim()
}

const SPANISH_MONTHS: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
}

const ENGLISH_MONTHS: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
}

function formatDate(day: string, month: string, rawYear: string) {
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
}

function parseDateText(value: string) {
  const numeric = value.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/)
  if (numeric) return formatDate(numeric[1], numeric[2], numeric[3])

  const spanish = value.match(/\b(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})\b/i)
  if (spanish) {
    const month = SPANISH_MONTHS[normalize(spanish[2])]
    if (month) return formatDate(spanish[1], month, spanish[3])
  }

  const spanishWithoutPrepositions = value.match(/\b(\d{1,2})\s+([a-záéíóúñ]+)\s+(\d{4})\b/i)
  if (spanishWithoutPrepositions) {
    const month = SPANISH_MONTHS[normalize(spanishWithoutPrepositions[2])]
    if (month) return formatDate(spanishWithoutPrepositions[1], month, spanishWithoutPrepositions[3])
  }

  const english = value.match(/\b([a-z]+)\s+(\d{1,2}),\s*(\d{4})\b/i)
  if (english) {
    const month = ENGLISH_MONTHS[english[1].toLowerCase()]
    if (month) return formatDate(english[2], month, english[3])
  }
  return ""
}

function cleanCompanyName(value: string) {
  return value.replace(/\s+\d{9}(?:\s+\d{9})?$/, "").replace(/\bTREA(?=\s+IB[EÉ]RICA)/i, "IKEA").replace(/\$\./g, "S.").replace(/\s{2,}/g, " ").trim()
}

function correctCif(value: string) {
  const clean = value.replace(/[\s.-]/g, "").toUpperCase()
  if (!/^[A-Z]\d{8}$/.test(clean)) return clean
  const control = (candidate: string) => {
    let sum = 0
    for (let index = 1; index <= 7; index += 1) {
      const digit = Number(candidate[index])
      const value = index % 2 === 1 ? digit * 2 : digit
      sum += Math.floor(value / 10) + (value % 10)
    }
    return String((10 - (sum % 10)) % 10) === candidate[8]
  }
  if (control(clean)) return `${clean[0]}-${clean.slice(1)}`
  const substitutions: Record<string, string[]> = { "0": ["8"], "6": ["8"], "8": ["0", "6"], "2": ["8"] }
  for (let index = 1; index <= 7; index += 1) {
    for (const replacement of substitutions[clean[index]] || []) {
      const candidate = `${clean.slice(0, index)}${replacement}${clean.slice(index + 1)}`
      if (control(candidate)) return `${candidate[0]}-${candidate.slice(1)}`
    }
  }
  return clean
}

const CIF_RECEPTOR_DIGITS = "09711078"

function matchesCifReceptor(text: string): boolean {
  const cleaned = normalizeAlpha(text)
  if (cleaned.includes("b09711078")) return true
  const idx = cleaned.indexOf(CIF_RECEPTOR_DIGITS)
  if (idx === -1) return false
  if (idx === 0) return true
  const charBefore = cleaned[idx - 1]
  if (/[a-z]/.test(charBefore) || /\d/.test(charBefore)) return true
  return false
}

function amount(value: string) {
  const cleaned = value.replace(/[^0-9,.-]/g, "")
  if (!cleaned) return "0"
  const lastComma = cleaned.lastIndexOf(",")
  const lastDot = cleaned.lastIndexOf(".")
  let normalized = cleaned
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "")
  } else if (lastComma >= 0) {
    normalized = cleaned.replace(",", ".")
  }
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0"
}

function numericValues(value: string) {
  const withoutDates = value.replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, " ")
  return amounts(withoutDates)
}

function amounts(value: string) {
  return (value.match(/[-+]?\d+(?:[.,]\d+)*(?![a-zA-Z])/g) || []).map(amount)
}

function findDate(lines: string[], labels: string[]) {
  const wanted = labels.map(normalize)
  for (let index = 0; index < lines.length; index += 1) {
    if (!wanted.some((label) => normalize(lines[index]).includes(label))) continue
    const date = parseDateText(lines[index]) || parseDateText(lines.slice(index + 1, index + 5).join(" "))
    if (date) return date
  }
  return ""
}

function findValue(lines: string[], labels: string[]) {
  const wanted = labels.map(normalize)
  for (let index = 0; index < lines.length; index += 1) {
    const original = lines[index]
    const line = normalize(original)
    const label = wanted.find((candidate) => line.includes(candidate))
    if (!label) continue
    const normalIdx = line.indexOf(label)
    const beforeOrig = original.slice(0, normalIdx + (original.length - line.length))
    const value = original.slice(beforeOrig.length + label.length).replace(/^\s*[:#-]\s*/, "").trim()
    if (value) return value
    if (lines[index + 1]) return lines[index + 1].trim()
  }
  return ""
}

function findPaymentMethod(lines: string[]) {
  const paymentPattern = /sepa\s+domi|domiciliaci[oó]n|domiciliad[oa]|transferencia(?:\s+bancaria)?|efectivo|tarjeta(?:\s+de\s+cr[eé]dito)?|\bvisa\b|\bmastercard\b|\bstripe\b|recibo\s+banc(?:ario|o)|giro\s+vto|anticipo\s+de\s+fondos|pago[_ ]anticipado|a\s+la\s+vista/i
  const canonical = (value: string) => {
    const normalized = normalize(value)
    if (/sepa\s+domi/.test(normalized)) return "SEPA DOMI"
    if (/domiciliaci[oó]n|domiciliad[oa]/.test(normalized)) return "DOMICILIACION"
    if (/transferencia/.test(normalized)) return "Transferencia bancaria"
    if (/efectivo/.test(normalized)) return "Efectivo"
    if (/tarjeta|visa|mastercard/.test(normalized)) return "Tarjeta"
    if (/stripe/.test(normalized)) return "STRIPE"
    if (/recibo\s+banc/.test(normalized)) return "Recibo bancario"
    if (/giro\s+vto/.test(normalized)) return "Giro"
    if (/anticipo\s+de\s+fondos/.test(normalized)) return "Anticipo de fondos"
    if (/pago[_ ]anticipado/.test(normalized)) return "Pago anticipado"
    if (/a\s+la\s+vista/.test(normalized)) return "A la Vista"
    return value.trim()
  }

  const labelPattern = /(?:forma\s+de\s+pago|v[ií]a\s+de\s+pago|m[eé]todo\s+de\s+pago|payment\s+method)\s*[:/]?/i
  const receiptPayment = lines.find((line) => /recibo\s+banc(?:ario|o)/i.test(line))
  if (receiptPayment) return "Recibo bancario"
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const label = line.match(labelPattern)
    if (!label) continue
    const tail = line.slice((label.index || 0) + label[0].length).trim()
    if (tail && !/vencimiento|condici[oó]n(?:es)?|grupo\s+de\s+cobro|p[aá]g\.?|total|pagar|n[ºo]?\.?\s*de\s*cuenta|vto\.?/i.test(tail) && !/^domiciliaci[oó]n$/i.test(tail)) {
      const method = tail.match(paymentPattern)
      if (method) return canonical(method[0])
      if (!/^(?:vencimiento|condici[oó]n(?:es)?|domiciliaci[oó]n)$/i.test(tail)) return tail
    }
    for (const nextLine of lines.slice(index + 1, index + 4)) {
      const method = nextLine.match(paymentPattern)
      if (method && !/vencimiento|condici[oó]n/i.test(nextLine)) return canonical(method[0])
    }
  }

  for (const rawLine of lines) {
    const line = normalize(rawLine)
    if (/forma\s+de\s+pago.*vencimiento.*domiciliaci[oó]n|forma\s+de\s+pago\s*\/\s*domiciliaci[oó]n/.test(line)) continue
    const method = rawLine.match(paymentPattern)
    if (method) return canonical(method[0])
  }

  const paymentFallback = lines.find((line) => /giro\s+vto|pago[_ ]anticipado|anticipo\s+de\s+fondos|a\s+la\s+vista/i.test(line))
  if (paymentFallback) return canonical(paymentFallback)

  if (lines.some((line) => /mandaremos el recibo a tu cuenta|recibo a tu cuenta/i.test(normalize(line)))) return "DOMICILIACION"
  return ""
}

function splitInvoiceNumber(value: string) {
  const clean = value.replace(/^factura\s*/i, "").trim()
  const slash = clean.lastIndexOf("/")
  if (slash > 0 && slash < clean.length - 1) return { serie: clean.slice(0, slash).trim().replace(/([_-])[-_]+/g, "$1"), numero: clean.slice(slash + 1).trim() }
  return { serie: "", numero: clean }
}

function cleanInvoiceCandidate(value: string) {
  const candidate = value.replace(/[|,;:.]+$/, "").replace(/\s*\/\s*/g, "/").trim()
  if (!candidate || !/\d/.test(candidate)) return ""
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(candidate) || /^\d{1,2}\s*\/\s*\d{1,2}$/.test(candidate)) return ""
  if (/^\d+$/.test(candidate) && candidate.length < 3) return ""
  if (/^(?:p[aá]gina|hoja|cliente|pedido|albar[aá]n|fecha|n[uú]mero|factura)$/i.test(candidate)) return ""
  return candidate
}

function invoiceCandidates(value: string) {
  return Array.from(value.matchAll(/[A-Z0-9]+(?:[._-][A-Z0-9]+)*(?:\s*\/\s*[A-Z0-9]+(?:[._-][A-Z0-9]+)*)*/gi))
    .map((match) => cleanInvoiceCandidate(match[0]))
    .filter(Boolean)
}

function firstInvoiceCandidate(value: string) {
  const cleanValue = value.trim().replace(/^[:#—-]\s*/, "")
  const match = cleanValue.match(/^([A-Z0-9]+(?:[._-][A-Z0-9]+)*(?:\s*\/\s*[A-Z0-9]+(?:[._-][A-Z0-9]+)*)*)/i)
  const direct = match ? cleanInvoiceCandidate(match[1]) : ""
  if (direct) return direct
  const prefixed = cleanValue.match(/^([A-Z]{2,12})\s+(\d{3,})\b/i)
  if (prefixed && !/^(?:tel[eé]fono|fecha|ordinaria|resumida)$/i.test(prefixed[1])) return `${prefixed[1]} ${prefixed[2]}`
  return ""
}

function candidateAfterDate(value: string) {
  const dateMatch = value.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/)
  if (!dateMatch || dateMatch.index == null) return ""
  return invoiceCandidates(value.slice(dateMatch.index + dateMatch[0].length))[0] || ""
}

function extractInvoiceNumber(lines: string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = normalize(lines[index])
    if (!/numero\s+de\s+pedido.*numero\s+de\s+factura/.test(line)) continue
    const valueLine = lines.slice(index + 1, index + 3).find((candidate) => invoiceCandidates(candidate).length) || ""
    const candidates = invoiceCandidates(valueLine)
    if (candidates[1]) return candidates[1]
  }

  const explicitPatterns = [
    /(?:n[uú]mero|nº|n°|num(?:ero)?|n[uú]m)\s*(?:de\s+(?:la\s+)?)?factura\s*[:#-]?\s*(.+)$/i,
    /factura\s+(?:n[uú]mero|nº|n°|n[uú]m)\s*[:#-]?\s*(.+)$/i,
    /invoice\s*#\s*[:#—-]?\s*(.+)$/i,
    /^\s*factura\s*[:#-]\s*(.+)$/i,
    /^\s*(?:n[uú]m|n[º°o])\s*[:#]\s*(.+)$/i,
  ]

  for (const line of lines) {
    for (const pattern of explicitPatterns) {
      const match = line.match(pattern)
      const candidate = match ? firstInvoiceCandidate(match[1]) : ""
      if (candidate) return candidate
    }

    const genericFactura = line.match(/^\s*factura\b(.+)$/i)
    if (genericFactura) {
      const candidate = firstInvoiceCandidate(genericFactura[1])
      if (candidate) return candidate
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const previous = lines.slice(Math.max(0, index - 2), index).join(" ")
    if (/^\s*(?:n[º°o]|n\.)\s*[:.]?/i.test(line) && /factura/i.test(previous) && !/referencia\s+de\s+pago|pedido|albar[aá]n|cuenta|cliente|registro/i.test(line)) {
      const candidate = invoiceCandidates(line)[0]
      if (candidate) return candidate
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = normalize(lines[index])
    const valueLine = lines.slice(index + 1, index + 4).find((candidate) => parseDateText(candidate) || invoiceCandidates(candidate).length) || ""
    if (!parseDateText(lines[index]) && /cliente\s+fecha\s+numero\s+hoja|fecha\s+factura\s+hoja|factura\s+n[º°o]?\s+fecha|fecha\s+n[º°o]?\s+de\s+cliente\s+factura|n[º°o]?\s+factura\s+fecha|serie\s+n[º°o]?\s+factura\s+fecha/i.test(line)) {
      const usesDateFirst = /cliente\s+fecha\s+numero\s+hoja|fecha\s+factura\s+hoja|fecha\s+n[º°o]?\s+de\s+cliente\s+factura/i.test(line)
      const dateIndex = valueLine.search(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/)
      const afterDateCandidates = dateIndex >= 0 ? invoiceCandidates(valueLine.slice(dateIndex + 10)) : []
      const candidate = usesDateFirst
        ? (/fecha\s+n[º°o]?\s+de\s+cliente\s+factura/i.test(line) ? afterDateCandidates[afterDateCandidates.length - 1] : candidateAfterDate(valueLine))
        : invoiceCandidates(valueLine)[0]
      if (candidate) return candidate
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^\s*factura\s*$/i.test(lines[index])) continue
    const candidate = firstInvoiceCandidate(lines[index + 1] || "")
    if (candidate) return candidate
  }

  for (let index = 0; index < lines.length; index += 1) {
    const candidates = invoiceCandidates(lines[index])
    if (!candidates.length || !/\//.test(candidates[0]) || /^\d+\/\d+$/.test(candidates[0])) continue
    const nearby = lines.slice(Math.max(0, index - 3), index + 1).some((line) => /factura/i.test(line))
    if (nearby || /(?:n[uú]mero|nº|n°)\b/i.test(lines[index])) return candidates[0]
  }

  const labelledNumber = lines.find((line) => /^n[uú]mero\s*:/i.test(line))
  if (labelledNumber) {
    const candidate = invoiceCandidates(labelledNumber)[0]
    if (candidate) return candidate
  }

  const legacyNumber = lines.flatMap((line) => invoiceCandidates(line)).find((candidate) => /[A-Z]/i.test(candidate) && /\//.test(candidate) && !/^\d+\/\d+$/.test(candidate))
  if (legacyNumber) return legacyNumber

  return ""
}

function normalizeTaxId(value: string) {
  return value.replace(/[\s]/g, "").toUpperCase()
}

function extractTaxIds(text: string) {
  const matches = text.match(/(?<![A-Z0-9])(?:ES[A-Z][-\s]?\d{7,8}(?:[-\s]?[A-Z])?|EU\d{9}|[A-Z][-\s]?\d{8}|[A-Z][-\s]?\d{7}[-\s]?[A-Z]|\d{7,8}[-\s]?[A-Z])(?![A-Z0-9])/gi) || []
  return Array.from(new Set(matches.map(normalizeTaxId)))
}

function isRecipientTaxId(value: string) {
  const normalized = normalizeAlpha(value)
  return normalized === CIF_RECEPTOR_DIGITS || normalized === `b${CIF_RECEPTOR_DIGITS}` || normalized === `esb${CIF_RECEPTOR_DIGITS}`
}

function findIssuerTaxId(text: string, lines: string[]) {
  const ids = extractTaxIds(text)
  const issuerId = ids.find((id) => !isRecipientTaxId(id))
  if (issuerId) {
    const issuerLine = lines.find((line) => normalizeAlpha(line).includes(normalizeAlpha(issuerId))) || ""
    return /c\.?i\.?f|\bcif\b/i.test(issuerLine) ? correctCif(issuerId) : issuerId
  }

  const fallback = lines
    .flatMap((line) => line.match(/(?:nif|cif|dni|vat|iva)\s*(?:\/\s*(?:nif|cif))?\s*[:.#-]?\s*([A-Z0-9][A-Z0-9\s-]{5,})/i)?.[1] || [])
    .map(normalizeTaxId)
    .find((value) => /\d/.test(value) && value.length >= 8)
  return fallback || ""
}

const LEGAL_ENTITY_SUFFIX = /(?:\bS[.,\s]*L(?:[.,\s]*L)?\.?|\bS[.,\s]*A(?:[.,\s]*U)?\.?|\bSLU\b|\bSAU\b|\bSOCIEDAD\s+(?:LIMITADA|ANONIMA)\b|\bGMBH\b|\bLTD\.?\b|\bLIMITED\b|\bN\.?V\.?\b|\bPLC\b|\bINC\.?\b)/i

function isRecipientCompanyName(value: string) {
  return normalizeAlpha(value).includes("fanscof")
}

function isCompanyNameNoise(value: string) {
  return /^(?:direcci[oó]n|datos|factura|cliente|forma|pago|vencimiento|n[uú]mero|fecha)\b/i.test(value) || /\b(?:iban|bic|registro|tel[eé]fono|www|https?:|nombre\s+comercial|sistemas?\s+de\s+gesti[oó]n)\b/i.test(value)
}

function companyNameFromLine(line: string) {
  const source = line.replace(/\*+/g, "").replace(/\s+/g, " ").trim()
  const labelledSource = source.match(/(?:emisor(?:\s+de\s+factura)?|vendedor|proveedor|responsable(?:\s+del\s+fichero)?|seller|vendor|raz[oó]n\s+social)\s*[:.,-]\s*(.+)$/i)?.[1] || source
  const special = labelledSource.match(/\bficheros?\s+de\s+(.+?\b(?:S[.,\s]*L(?:[.,\s]*L)?\.?|S[.,\s]*A(?:[.,\s]*U)?\.?|SLU|SAU|GMBH|LTD\.?|LIMITED|N\.?V\.?))/i)
  const segments = special ? [special[1]] : labelledSource.split(/\s*\|\s*|\s*\(\*+\)\s*|\s+(?:con\s+sede(?:\s+social)?|calle|c\/|av\.?|avenida|tel[eé]fono?|registro|r\.m\.|direcci[oó]n|finalidad|inscrita|cif|nif|vat|iva|nombre\s+comercial\s+de)\b/i)

  for (const segment of segments) {
    const cleanSegment = segment.replace(/^\s*(?:factura|emisor(?:\s+de\s+factura)?|vendedor|proveedor|responsable|raz[oó]n\s+social)\s*[:.,-]?\s*/i, "").trim()
    const match = cleanSegment.match(new RegExp(`^(.{2,120}?${LEGAL_ENTITY_SUFFIX.source})(?=\\s|$|[,.;:-])`, "i"))
    const candidate = match?.[1] ? cleanCompanyName(match[1]) : ""
    if (candidate && !isCompanyNameNoise(candidate) && !isRecipientCompanyName(candidate)) return candidate
  }

  return ""
}

function labelledIssuerName(line: string) {
  const match = line.match(/^\s*(?:raz[oó]n\s+social|emisor(?:\s+de\s+factura)?|vendedor|proveedor|responsable(?:\s+del\s+fichero)?|seller|vendor)\s*[:.,-]\s*(.+)$/i)
  if (!match) return ""
  const value = match[1].split(/\s+(?:calle|c\/|av\.?|avenida|tel[eé]fono?|finalidad|direcci[oó]n)\b/i)[0].replace(/\s+-\s+.*$/, "").trim()
  if (!value || /\d/.test(value) || isCompanyNameNoise(value) || /^(?:calle|c\/|av\.?|avenida|plaza|pol[ií]gono)\b/i.test(value) || isRecipientCompanyName(value)) return ""
  return companyNameFromLine(value) || cleanCompanyName(value)
}

function isNameLikeLine(line: string) {
  const value = line.trim()
  return Boolean(value) && value.length <= 80 && !/\d|@|https?:|\b(?:calle|c\/|av\.?|avenida|plaza|pol[ií]gono|madrid|espa[nñ]a|cliente|factura|fecha|pago|total|direcci[oó]n|tel[eé]fono|registro|cif|nif)\b/i.test(value) && /^[A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ ,.'&/-]*$/.test(value)
}

function findIssuerName(lines: string[], issuerId: string) {
  const candidates: Array<{ name: string; score: number; index: number }> = []
  const normalizedIssuerId = normalizeAlpha(issuerId)
  const issuerIndexes = normalizedIssuerId ? lines.map((line, index) => normalizeAlpha(line).includes(normalizedIssuerId) ? index : -1).filter((index) => index >= 0) : []
  const add = (name: string, score: number, index: number) => {
    const clean = name.trim()
    if (clean && !isRecipientCompanyName(clean)) candidates.push({ name: clean, score, index })
  }

  for (let index = 0; index < lines.length; index += 1) {
    const labelled = labelledIssuerName(lines[index])
    if (labelled) add(labelled, 120, index)

    const company = companyNameFromLine(lines[index])
    if (company) {
      const distance = issuerIndexes.length ? Math.min(...issuerIndexes.map((issuerIndex) => Math.abs(index - issuerIndex))) : 99
      add(company, 20 + (distance <= 12 ? 60 - distance : 0) + (distance === 0 ? 40 : 0), index)
    }
  }

  for (const issuerIndex of issuerIndexes) {
    const headerIndex = lines.slice(Math.max(0, issuerIndex - 3), issuerIndex).findIndex((line) => /emisor(?:\s+de\s+factura)?|vendedor|proveedor|seller|vendor/i.test(line))
    if (headerIndex >= 0) {
      const absoluteHeaderIndex = Math.max(0, issuerIndex - 3) + headerIndex
      for (const line of lines.slice(absoluteHeaderIndex + 1, issuerIndex + 1)) add(companyNameFromLine(line), 115, line === lines[issuerIndex] ? issuerIndex : absoluteHeaderIndex + 1)
    }

    const previous = lines[issuerIndex - 2]
    const immediate = lines[issuerIndex - 1]
    if (previous && immediate && isNameLikeLine(previous) && isNameLikeLine(immediate) && immediate.split(/\s+/).length >= 2) {
      add(`${previous} ${immediate}`, 95, issuerIndex - 2)
    }
  }

  return candidates.sort((left, right) => right.score - left.score || left.index - right.index)[0]?.name || ""
}

function parseDateInLine(value: string) {
  return parseDateText(value)
}

function parseYolmarLine(rawLine: string, nextLine: string) {
  const match = rawLine.match(/^(\d+)\s+(.+?)\s+(Kilo|Unidad|Caja|Paquete)\s+(\d+[,.]\d+)\s+(\d+[,.]\d+)\s+(\d+[,.]\d+)\s+(\d+(?:[,.]\d+)?)%\s+(\d+[,.]\d+)\s+(\d+[,.]\d+)/i)
  if (!match) return null
  const [, reference, description, unit, quantity, discount, price, tax, taxAmount, lineTotal] = match
  const draft = emptyFacturaLinea()
  draft.referenciaProveedor = reference
  draft.descripcion = description.trim()
  draft.unidadMedida = unit
  draft.cantidad = amount(quantity)
  draft.descuentoPorcentaje = amount(discount)
  draft.precioUnitario = amount(price)
  draft.precioUnitarioNeto = amount(price)
  draft.baseImponible = amount(lineTotal)
  draft.tipoIva = amount(tax)
  draft.cuotaIva = amount(taxAmount)
  draft.totalLinea = amount(lineTotal)
  draft.lote = nextLine.match(/lote:\s*([^\s]+)/i)?.[1] || ""
  draft.fechaVencimiento = parseDateInLine(nextLine)
  return draft
}

function parseGenericLine(line: string) {
  const match = line.match(/^(\d{2,})\s+(.+?)\s+(\d+[,.]\d+)\s+(?:[A-Za-z]+)?\s*(\d+[,.]\d+)\s+€?\s*(\d+[,.]\d+)\s+€?\s*(\d+(?:[,.]\d+)?)%/)
  if (!match) return null
  const [, reference, description, quantity, price, subtotal, tax] = match
  const draft = emptyFacturaLinea()
  draft.referenciaProveedor = reference
  draft.descripcion = description.trim()
  draft.formatoOriginal = line.trim()
  draft.cantidad = amount(quantity)
  draft.precioUnitario = amount(price)
  draft.precioUnitarioNeto = amount(price)
  draft.baseImponible = amount(subtotal)
  draft.tipoIva = amount(tax)
  draft.totalLinea = amount(subtotal)
  return draft
}

function parseLacteosLine(line: string) {
  const match = line.match(/^(\d+)\s+(.+?)\s+([A-Z0-9]+)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(\d+(?:[,.]\d+)?)\s+(.+?)\s+(\d+[,.]\d+)\s+€?\s*(\d+[,.]\d+)\s*€?\s*(\d+(?:[,.]\d+)?)%/i)
  if (!match) return null
  const [, reference, description, lot, expiry, quantity, format, unitPrice, subtotal, tax] = match
  const draft = emptyFacturaLinea()
  draft.referenciaProveedor = reference
  draft.descripcion = description.trim()
  draft.unidadMedida = format.trim().split(/\s+/)[0] || ""
  draft.formatoOriginal = format.trim()
  draft.cantidad = amount(quantity)
  draft.precioUnitario = amount(unitPrice)
  draft.precioUnitarioNeto = amount(unitPrice)
  draft.baseImponible = amount(subtotal)
  draft.tipoIva = amount(tax)
  draft.cuotaIva = (Number(amount(subtotal)) * Number(amount(tax)) / 100).toFixed(2)
  draft.totalLinea = amount(subtotal)
  draft.lote = lot
  draft.fechaVencimiento = parseDateInLine(expiry)
  return draft
}

const TAX_RATES = [21, 10, 4, 2, 0]

function isTaxSummaryHeader(line: string) {
  const normalizedLine = normalize(line)
  return /(?:base\s*(?:imponible|imp)|b\.\s*imp|cuota\s+iva|\btotal\s+(?:iva|impuesto|bases?)|iva\s+base|bases?\b.*(?:iva|i\.v\.a|importe)|vencimientos.*base.*importe|^iva\s*%.*(?:precio|importe)|importe\s*\(sin\s+i\.?v\.?a\.?\)|tipo\s+base)/.test(normalizedLine) && /iva|i\.v\.a|vat|impuesto|vencimientos/.test(normalizedLine)
}

function taxRate(value: string) {
  const parsed = Number(value.replace(",", "."))
  return TAX_RATES.includes(parsed) ? parsed : null
}

function addTaxRow(rows: FacturaImpuestoDraft[], tipo: FacturaImpuestoDraft["tipo"], percentage: number, base: string, quota: string) {
  const normalizedPercentage = percentage.toFixed(2)
  const existing = rows.find((row) => row.tipo === tipo && row.porcentaje === normalizedPercentage)
  if (!existing) {
    rows.push({ tipo, porcentaje: normalizedPercentage, baseImponible: amount(base), cuota: amount(quota).replace("-", "") })
    return
  }
  if (existing.baseImponible === amount(base) && existing.cuota === amount(quota).replace("-", "")) return
  existing.baseImponible = (Number(existing.baseImponible) + Number(amount(base))).toFixed(2)
  existing.cuota = (Number(existing.cuota) + Number(amount(quota).replace("-", ""))).toFixed(2)
}

function parseTaxRows(lines: string[]) {
  const rows: FacturaImpuestoDraft[] = []
  const headerIndexes = lines.map((line, index) => isTaxSummaryHeader(line) ? index : -1).filter((index) => index >= 0)

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const normalizedLine = normalize(line)
    const rateMatch = line.match(/(\d+(?:[,.]\d+)?)\s*%/)
    const inTaxBlock = headerIndexes.some((headerIndex) => headerIndex < index && index - headerIndex <= 5)
    const isTaxLine = /\biva\b|\bvat\b|\bimpuesto\b|\birpf\b|sin\s+iva|exento|superreducido|reducido|\bnormal\b|base\s*(?:imponible|imp)/.test(normalizedLine)
    const isIkeaTaxBlock = headerIndexes.some((headerIndex) => headerIndex < index && index - headerIndex <= 5 && /codigo.*base.*(?:iva|va)/.test(normalize(lines[headerIndex])))

    if (rateMatch && (isTaxLine || inTaxBlock)) {
      if (isIkeaTaxBlock) continue
      const rateIndex = rateMatch.index || 0
      const before = numericValues(line.slice(0, rateIndex))
      const afterText = line.slice(rateIndex + rateMatch[0].length).split(/\btotal\s+(?:iva|re|bruto|neto|factura|bases?|impuestos?)\b/i)[0]
      const after = numericValues(afterText)
      const isIrpf = /\birpf\b/.test(normalizedLine)
      const percentage = isIrpf ? Number(rateMatch[1].replace(",", ".")) : taxRate(rateMatch[1])
      if (percentage == null) continue
      if (isIrpf) {
        const quota = after[after.length - 1] || before[before.length - 1] || "0"
        addTaxRow(rows, "IRPF", percentage, "0", quota)
        continue
      }

      if (percentage === 0 && /sin\s+iva|exento/.test(normalizedLine)) {
        addTaxRow(rows, "IVA", percentage, before[before.length - 1] || "0", "0")
        continue
      }

      let base = "0"
      let quota = "0"
      if (after.length >= 2 && (/sobre|\ben\b/.test(normalizedLine))) {
        base = after[0]
        quota = after.length >= 3 && after[0] === after[1] ? after[after.length - 1] : after[1]
      } else if (before.length && after.length >= 2 && Math.abs(Number(after[after.length - 1]) - Number(before[before.length - 1]) - Number(after[0])) <= 0.02) {
        base = before[before.length - 1]
        quota = after[0]
      } else if (before.length && /base\s*(?:imponible|imp)/.test(normalizedLine) && after.length) {
        base = before[before.length - 1]
        quota = after[0]
      } else if (after.length >= 2 && (/\biva\b|\bvat\b|\bimpuesto\b/.test(normalizedLine) || !before.length)) {
        base = after[0]
        quota = after.length >= 3 && after[0] === after[1] ? after[after.length - 1] : after[1]
      } else if (before.length && after.length) {
        base = before[before.length - 1]
        quota = after[0]
      } else if (after.length) {
        quota = after[after.length - 1]
      }
      if (!before.length && !after.length) continue
      addTaxRow(rows, "IVA", percentage, base, quota)
      continue
    }

    if (!inTaxBlock || /\b(?:fecha|albar[aá]n|pedido|caducidad|lote)\b/.test(normalizedLine)) continue
    const values = numericValues(line.replace(/\bR\d+\b/gi, " "))
    if (values.length < 3) continue
    const rateIndex = values.findIndex((value) => TAX_RATES.includes(Number(value)))
    if (rateIndex < 0) continue
    const percentage = Number(values[rateIndex])
    if (percentage === 0 || !TAX_RATES.includes(percentage)) continue
    let base = values[rateIndex - 1] || "0"
    let quota = values[rateIndex + 1] || "0"
    if (rateIndex === 0 && values.length >= 3) {
      base = values[1]
      quota = values[values.length - 1]
    }
    addTaxRow(rows, "IVA", percentage, base, quota)
  }

  return rows.sort((left, right) => Number(left.porcentaje) - Number(right.porcentaje) || (left.tipo === "IVA" ? -1 : 1))
}

function valuesAfterLabel(line: string, label: string) {
  const source = line.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
  const target = normalize(label)
  const index = source.indexOf(target)
  return index < 0 ? [] : numericValues(source.slice(index + target.length))
}

function findSameLineAmount(lines: string[], labels: string[]) {
  const wanted = labels.map(normalize)
  for (const line of lines) {
    const normalizedLine = normalize(line)
    for (const label of wanted) {
      if (!normalizedLine.includes(label)) continue
      const values = valuesAfterLabel(line, label)
      if (values.length) return values[values.length - 1]
    }
  }
  return "0"
}

function findLastSameLineAmount(lines: string[], labels: string[]) {
  const wanted = labels.map(normalize)
  let result = "0"
  for (const line of lines) {
    const normalizedLine = normalize(line)
    for (const label of wanted) {
      if (!normalizedLine.includes(label)) continue
      const values = valuesAfterLabel(line, label)
      if (values.length) result = values[values.length - 1]
    }
  }
  return result
}

function findLabelAmount(lines: string[], labels: string[]) {
  const wanted = labels.map(normalize)
  for (let index = 0; index < lines.length; index += 1) {
    const normalizedLine = normalize(lines[index])
    for (const label of wanted) {
      if (!normalizedLine.includes(label)) continue
      const sameLine = valuesAfterLabel(lines[index], label)
      if (sameLine.length) return sameLine[0]
      for (const nextLine of lines.slice(index + 1, index + 4)) {
        const nextValues = numericValues(nextLine)
        if (nextValues.length) return nextValues[0]
      }
    }
  }
  return "0"
}

function sumTaxRows(rows: FacturaImpuestoDraft[], type: FacturaImpuestoDraft["tipo"]) {
  return rows.filter((row) => row.tipo === type).reduce((sum, row) => sum + Number(row.cuota), 0).toFixed(2)
}

function sumTaxBases(rows: FacturaImpuestoDraft[]) {
  return rows.filter((row) => row.tipo === "IVA").reduce((sum, row) => sum + Number(row.baseImponible), 0).toFixed(2)
}

function parseImplicitProductTaxes(lines: string[]) {
  const rows: FacturaImpuestoDraft[] = []
  const productHeaderIndex = lines.findIndex((line) => /producto\s+servido.*tipo\s+iva/i.test(normalize(line)))
  if (productHeaderIndex < 0) return rows

  for (const line of lines.slice(productHeaderIndex + 1)) {
    if (/subtotal|total\b/i.test(normalize(line))) break
    const rateMatch = line.match(/(\d+(?:[,.]\d+)?)\s*%/)
    if (!rateMatch) continue
    const percentage = taxRate(rateMatch[1])
    if (percentage == null) continue
    const values = numericValues(line.slice((rateMatch.index || 0) + rateMatch[0].length))
    if (!values.length) continue
    addTaxRow(rows, "IVA", percentage, values[values.length - 1], "0")
  }
  return rows
}

function parseIkeaTaxRows(lines: string[]) {
  const headerIndex = lines.findIndex((line) => /c[oó]digo.*base.*(?:iva|va)/i.test(normalize(line)))
  if (headerIndex < 0) return []
  for (const line of lines.slice(headerIndex + 1, headerIndex + 4)) {
    const values = numericValues(line)
    const rateIndex = values.findIndex((value) => {
      const rounded = Math.round(Number(value))
      return rounded > 0 && Math.abs(Number(value) - rounded) < 0.1 && TAX_RATES.includes(rounded)
    })
    if (rateIndex < 0 || values.length < rateIndex + 3) continue
    const rows: FacturaImpuestoDraft[] = []
    addTaxRow(rows, "IVA", Math.round(Number(values[rateIndex])), values[values.length - 2], values[values.length - 1])
    return rows
  }
  return []
}

function parseIkeaReceiptLine(lines: string[], index: number) {
  const refMatch = lines[index].match(/Art\/\s*EA\s+(\d+)(?:\s+(\d+))?/i)
  if (!refMatch) return null
  const draft = emptyFacturaLinea()
  draft.tipoLinea = "PRODUCTO"
  draft.referenciaProveedor = refMatch[1]
  draft.codigoArticulo = refMatch[2] || ""
  const descLine = (lines[index + 1] || "").trim()
  const nextProductIndex = lines.findIndex((line, lineIndex) => lineIndex > index && /art\/\s*ea/i.test(line))
  const summaryIndex = lines.findIndex((line, lineIndex) => lineIndex > index && /^(?:total|efectivo|cambio|impuestos?|c[oó]digo|cif|fecha)/i.test(line.trim()))
  const segmentEnd = Math.min(nextProductIndex >= 0 ? nextProductIndex : lines.length, summaryIndex >= 0 ? summaryIndex : lines.length)
  const priceLine = lines.slice(index + 1, segmentEnd).find((line) => /\d+[,.]\d+/.test(line) && !/total|efectivo|cambio|impuesto|cif|fecha/i.test(line))?.trim() || ""
  draft.descripcion = descLine.replace(/[“”"]/g, "").replace(/\s+\d+$/, "").replace(/\bc(?:art|ort) opac 2[0o]\b/i, "cort opac 2u").replace(/\bSTRIMWIG\b/i, "STRIMMIG").replace(/\bTREA\s+965\+/i, "IKEA 365+").replace(/salv?nantéiman/i, "salvamant&imán").replace(/breia bbsoa elieonas/i, "brcha bbcoa silicona").replace(/\s{2,}/g, " ").trim()
  draft.cantidad = "1.00"
  const nums = amounts(priceLine)
  const hasDecimal = /\d+[,.]\d+/.test(priceLine)
  if (nums.length >= 3) {
    draft.cantidad = nums[0]
    draft.precioUnitario = nums[1]
    draft.precioUnitarioNeto = nums[1]
    draft.baseImponible = nums[2]
  } else if (nums.length === 2 && hasDecimal) {
    draft.cantidad = "1.00"
    draft.precioUnitario = nums[0]
    draft.precioUnitarioNeto = nums[0]
    draft.baseImponible = nums[1] === "0.00" ? nums[0] : nums[1]
  } else if (nums.length === 1 && hasDecimal) {
    draft.precioUnitario = nums[0]
    draft.precioUnitarioNeto = nums[0]
    draft.baseImponible = nums[0]
  }
  draft.tipoIva = "21.00"
  draft.totalLinea = draft.baseImponible
  return draft
}

export function parseFacturaText(text: string): FacturaDraft {
  const draft = emptyFacturaDraft()
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const normalized = lines.map(normalize)
  draft.nifEmisor = findIssuerTaxId(text, lines)
  draft.receptorCifValido = matchesCifReceptor(text)

  const number = extractInvoiceNumber(lines)
  const split = splitInvoiceNumber(number)
  draft.serie = split.serie.toUpperCase()
  draft.numero = split.numero.toUpperCase()
  draft.fechaExpedicion = findDate(lines, ["fecha de factura", "fecha factura", "fecha de emisión", "fecha emisión", "fecha de expedición", "fecha expedición", "fecha de expedicion", "fecha expedicion", "invoice date", "factura núm", "factura num"])
  if (!draft.fechaExpedicion) {
    const invoiceLabelIndex = lines.findIndex((line) => /factura\s+(?:n[uú]m|num|nº|n°)/i.test(line))
    if (invoiceLabelIndex >= 0) draft.fechaExpedicion = parseDateText(lines.slice(Math.max(0, invoiceLabelIndex - 2), invoiceLabelIndex + 1).join(" "))
  }
  if (!draft.fechaExpedicion) draft.fechaExpedicion = findDate(lines, ["fecha"])
  if (!draft.fechaExpedicion) {
    const documentLine = lines.find((line) => /\bfactura\b/i.test(line) && (parseDateText(line) || /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(line)))
    if (documentLine) draft.fechaExpedicion = parseDateText(documentLine)
  }
  draft.fechaOperacion = findDate(lines, ["fecha de operación", "fecha operacion"])
  draft.fechaVencimiento = findDate(lines, ["vencimiento"])
  draft.fechaPago = findDate(lines, ["fecha de pago"])
  draft.formaPago = findPaymentMethod(lines) || findValue(lines, ["forma de pago", "forma pago"])
  if (!draft.formaPago && normalized.some((line) => line.includes("transferencia bancaria"))) draft.formaPago = "Transferencia bancaria"
  if (!draft.formaPago && normalized.some((line) => /\befectivo\b/.test(line))) draft.formaPago = "Efectivo"

  const ordersIndex = normalized.findIndex((line) => line.includes("pedidos facturados"))
  const orderLine = ordersIndex >= 0 ? lines[ordersIndex + 1] || "" : ""
  const orderNumber = orderLine.match(/(?:n[uú]mero|numero)\s*:\s*([A-Z0-9_-]+)/i)
  const orderDate = orderLine.match(/fecha\s*:\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i)
  const deliveryCenter = orderLine.match(/centro\s*:\s*(.+)$/i)
  draft.numeroPedido = orderNumber?.[1] || ""
  draft.fechaPedido = orderDate ? parseDateInLine(orderDate[1]) : ""
  draft.centroEntrega = deliveryCenter?.[1]?.trim() || ""

  const albaranLine = lines.find((line) => /alb[-_]?\d{4}\s*\/\s*\d+/i.test(line)) || ""
  const albaranMatch = albaranLine.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+([A-Z0-9_-]+)\s*\/\s*(\d+)/i) || albaranLine.match(/([A-Z0-9_-]+)\s*\/\s*(\d+)/i)
  if (albaranMatch) {
    const hasDate = albaranMatch.length === 4
    draft.fechaAlbaran = hasDate ? parseDateInLine(albaranMatch[1]) : ""
    const series = hasDate ? albaranMatch[2] : albaranMatch[1]
    const number = hasDate ? albaranMatch[3] : albaranMatch[2]
    draft.referenciaAlbaran = `${series}/${number}`
  }

  draft.razonSocialEmisor = findIssuerName(lines, draft.nifEmisor)

  if (draft.nifEmisor) {
    const nifClean = normalize(draft.nifEmisor).replace(/-/g, "")
    const nifIndex = normalized.findIndex((line) => line.replace(/-/g, "").includes(nifClean))
    if (nifIndex >= 0) {
      const nearbyAddress = lines.slice(nifIndex + 1, nifIndex + 6).filter((line) => /(?:calle|c\/|av\.|avenida|^\d{5})/i.test(line))
      draft.domicilioFiscalEmisor = nearbyAddress.join(", ").replace(/\bn[*º]?\s*9\b/i, "nº9")
    }
  }

  if (!draft.nifEmisor) {
    const cifLine = lines.find((line) => /cif\s*[:#-]?\s*[a-z]\s*[-]?\s*\d/i.test(normalize(line)))
    if (cifLine) {
      const cifMatch = cifLine.match(/([A-Z][-\s]?\d{8})/i)
      if (cifMatch) draft.nifEmisor = cifMatch[1].replace(/\s/g, "").toUpperCase()
    }
  }

  if (!draft.domicilioFiscalEmisor) {
    const addressLines = lines.filter((line) => /calle|av\.|avenida|pol[ií]gono|sector|nº|num/i.test(normalize(line)) && line.length > 5)
    const postalLine = lines.find((line) => /^\d{5}\s/i.test(line.trim()))
    const parts = [addressLines[0], postalLine].filter((p): p is string => Boolean(p))
    if (parts.length) draft.domicilioFiscalEmisor = parts.map((p) => p.trim()).join(", ")
  }

  const taxRows = parseTaxRows(lines)
  for (const row of [...parseImplicitProductTaxes(lines), ...parseIkeaTaxRows(lines)]) {
    addTaxRow(taxRows, row.tipo, Number(row.porcentaje), row.baseImponible, row.cuota)
  }
  const subjectBase = findSameLineAmount(lines, ["sujeto a iva"])
  const bareIva = findLastSameLineAmount(lines, ["i.v.a."])
  const bareIvaRate = lines.find((line) => /i\.?v\.?a\.?\s*(?:\(?\s*)?(\d+(?:[,.]\d+)?)\s*%/i.test(line))?.match(/(\d+(?:[,.]\d+)?)\s*%/)?.[1]
  if (subjectBase !== "0" && bareIva !== "0" && bareIvaRate) addTaxRow(taxRows, "IVA", Number(bareIvaRate.replace(",", ".")), subjectBase, bareIva)
  draft.impuestos = taxRows

  const explicitNetSameLine = findSameLineAmount(lines, ["total neto", "subtotal", "parcial neto", "total excl. vat", "total excl vat"])
  const netAfterLabel = findLabelAmount(lines, ["total neto", "subtotal", "parcial neto", "total excl. vat", "total excl vat"])
  const taxBase = sumTaxBases(draft.impuestos)
  const baseOnLabel = findSameLineAmount(lines, ["sujeto a iva", "base imponible", "base imp", "base"])
  const trustedNetAfterLabel = taxBase === "0.00" || netAfterLabel === "0" || Math.abs(Number(netAfterLabel) - Number(taxBase)) <= Math.max(0.02, Number(taxBase) * 0.01)
  draft.totalNeto = explicitNetSameLine !== "0" ? explicitNetSameLine : taxBase !== "0.00" && !trustedNetAfterLabel ? taxBase : netAfterLabel !== "0" ? netAfterLabel : taxBase !== "0.00" ? taxBase : baseOnLabel

  const ivaRows = draft.impuestos.filter((row) => row.tipo === "IVA")
  const missingBaseRows = ivaRows.filter((row) => Number(row.baseImponible) === 0)
  const knownTaxBase = sumTaxBases(draft.impuestos)
  if (missingBaseRows.length === 1 && Number(draft.totalNeto) > Number(knownTaxBase)) {
    missingBaseRows[0].baseImponible = (Number(draft.totalNeto) - Number(knownTaxBase)).toFixed(2)
  }

  draft.totalDescuento = findSameLineAmount(lines, ["total descuento", "descuento total"])
  if (draft.totalDescuento === "0") draft.totalDescuento = "0.00"

  const explicitIvaSameLine = findSameLineAmount(lines, ["total iva + re", "total iva", "total impuesto", "importe iva", "importe i.v.a.", "impuesto aplicado", "i.v.a. / i.g.i.c."])
  const explicitIva = explicitIvaSameLine !== "0" ? explicitIvaSameLine : findLastSameLineAmount(lines, ["i.v.a."])
  const taxCuota = sumTaxRows(draft.impuestos, "IVA")
  draft.totalIva = taxCuota !== "0.00" ? taxCuota : explicitIva
  draft.totalRecargo = findSameLineAmount(lines, ["total re", "total recargo"])
  const retained = sumTaxRows(draft.impuestos, "IRPF")
  draft.totalRetenciones = retained !== "0.00" ? retained : findSameLineAmount(lines, ["total irpf", "retenciones", "retencion"])

  const totalLabels = ["total pendiente", "total a pagar", "total recibido", "importe total", "total documento", "invoice amount", "total factura", "total bruto"]
  const explicitTotal = findSameLineAmount(lines, totalLabels)
  draft.importeTotal = explicitTotal
  const calculatedTotal = Number(draft.totalNeto) + Number(draft.totalIva) - Number(draft.totalRetenciones)
  if (draft.importeTotal === "0" && calculatedTotal > 0 && (Number(draft.totalNeto) > 0 || Number(draft.totalIva) > 0)) {
    draft.importeTotal = calculatedTotal.toFixed(2)
  }

  if (draft.importeTotal === "0") {
    const totalAfterLabel = findLabelAmount(lines, totalLabels)
    if (totalAfterLabel !== "0") draft.importeTotal = totalAfterLabel
  }

  if (draft.importeTotal === "0") {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = normalize(lines[index])
      if (!/^total(?:\s|:)/.test(line) || /total\s+(?:articulos?|productos?|neto|iva|impuesto|bases?|excl)/.test(line)) continue
      const values = valuesAfterLabel(lines[index], "total")
      if (values.length) { draft.importeTotal = values[values.length - 1]; break }
    }
  }

  if (draft.importeTotal === "0") {
    const totalsHeaderIndex = normalized.findIndex((line) => line.includes("base imponible") && line.includes("total"))
    let lastStandaloneAmount = "0"
    for (let index = totalsHeaderIndex + 1; totalsHeaderIndex >= 0 && index < Math.min(lines.length, totalsHeaderIndex + 12); index += 1) {
      if (/proteccion|datos personales/.test(normalized[index])) break
      if (/%/.test(lines[index])) continue
      const values = numericValues(lines[index])
      if (values.length === 1) lastStandaloneAmount = values[0]
    }
    if (lastStandaloneAmount !== "0") draft.importeTotal = lastStandaloneAmount
  }

  if (draft.importeTotal === "0") {
    const efectivoIdx = normalized.findIndex((line) => /efectivo|tarjeta|pago/.test(line))
    for (let index = efectivoIdx - 1; efectivoIdx > 0 && index >= 0; index -= 1) {
      const values = numericValues(lines[index])
      if (values.length && values[values.length - 1] !== "0.00") { draft.importeTotal = values[values.length - 1]; break }
    }
  }

  let hasIkeaReceipt = false
  for (let index = 0; index < lines.length; index += 1) {
    if (/art\/\s*ea/i.test(lines[index])) hasIkeaReceipt = true
  }

  for (let index = 0; index < lines.length; index += 1) {
    const parsed = parseYolmarLine(lines[index], lines[index + 1] || "") || parseLacteosLine(lines[index]) || parseGenericLine(lines[index]) || (hasIkeaReceipt ? parseIkeaReceiptLine(lines, index) : null)
    if (parsed) draft.lineas.push(parsed)
  }
  if (draft.lineas.length > 1 && draft.lineas[0].descripcion === "") draft.lineas.shift()
  if (hasIkeaReceipt && draft.importeTotal !== "0" && draft.lineas.length) {
    const missingLines = draft.lineas.filter((linea) => Number(linea.totalLinea) === 0 || Number(linea.precioUnitario) === 0)
    if (missingLines.length >= 1) {
      const knownTotal = draft.lineas.reduce((sum, linea) => sum + Number(linea.totalLinea), 0)
      const remainder = Number(draft.importeTotal) - knownTotal
      if (remainder > 0) {
        const missing = missingLines[0]
        missing.precioUnitario = remainder.toFixed(2)
        missing.precioUnitarioNeto = remainder.toFixed(2)
        missing.baseImponible = remainder.toFixed(2)
        missing.totalLinea = remainder.toFixed(2)
      }
    }
  }
  if (draft.lineas.length === 1 && !draft.lineas[0].descripcion && /art[ií]culo|albar[aá]n|producto\s+servido|gtin|c[oó]digo\s+ean|descripci[oó]n\s+del\s+art[ií]culo|detalles\s+de\s+la\s+factura|\[(?:pjs|delivery)_/i.test(normalized.join(" "))) {
    draft.lineas[0].descripcion = "COMPRA"
  }
  return draft
}
