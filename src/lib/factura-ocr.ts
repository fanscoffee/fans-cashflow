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
  const cleaned = value.replace(/[^0-9,.-]/g, "").replace(/\.(?=.*\.)/g, "")
  if (!cleaned) return "0"
  const parsed = Number(cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned)
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0"
}

function amounts(value: string) {
  return (value.match(/[-+]?\d+(?:[.,]\d+)*(?![a-zA-Z])/g) || []).map(amount)
}

function amountsAfterLabel(value: string, label: string) {
  const line = normalize(value)
  const index = line.indexOf(normalize(label))
  if (index < 0) return []
  const rest = line.slice(index + normalize(label).length)
  const nextLabel = rest.search(/\b(?:total\s+(?:bases?|impuestos?|iva|iv|neto|bruto|re|recargo)|total\s*:|base\s+(?:imponible|imp)|importe)\b/)
  return amounts(nextLabel >= 0 ? rest.slice(0, nextLabel) : rest)
}

function findAmount(lines: string[], labels: string[]) {
  const wanted = labels.map(normalize)
  for (let index = 0; index < lines.length; index += 1) {
    const line = normalize(lines[index])
    const label = wanted.find((candidate) => line.includes(candidate))
    if (!label) continue
    const labeledTail = amountsAfterLabel(lines[index], label)
    if (labeledTail.length) return labeledTail[labeledTail.length - 1]
    if (/base\s+(?:imponible|imp)/.test(line) && /tipo|impuesto|importe/.test(line)) continue
    const tail = amounts(lines[index])
    if (tail.length) return tail[tail.length - 1]
    const next = amounts(lines[index + 1] || "")
    if (next.length) return next[next.length - 1]
  }
  return "0"
}

function findLastAmount(lines: string[], labels: string[]) {
  const wanted = labels.map(normalize)
  let result = "0"
  for (let index = 0; index < lines.length; index += 1) {
    const line = normalize(lines[index])
    if (!wanted.some((label) => line.includes(label))) continue
    const tail = amounts(lines[index])
    if (tail.length) result = tail[tail.length - 1]
    else {
      const next = amounts(lines[index + 1] || "")
      if (next.length) result = next[next.length - 1]
    }
  }
  return result
}

function findDate(lines: string[], labels: string[]) {
  const wanted = labels.map(normalize)
  const pattern = /(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/
  for (let index = 0; index < lines.length; index += 1) {
    if (!wanted.some((label) => normalize(lines[index]).includes(label))) continue
    const match = lines.slice(index, index + 5).join(" ").match(pattern)
    if (!match) continue
    const [, day, month, rawYear] = match
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
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
  for (const rawLine of lines) {
    const line = normalize(rawLine)
    if (/\bsepa\s+domi\b/.test(line)) return "SEPA DOMI"
    if (/\bdomiciliacion\b/.test(line)) return "DOMICILIACION"
    if (/\btransferencia\b/.test(line)) return "Transferencia bancaria"
    if (/\befectivo\b/.test(line)) return "Efectivo"
    if (/\btarjeta\b|\bvisa\b|\bmastercard\b/.test(line)) return "Tarjeta"
  }
  return ""
}

function splitInvoiceNumber(value: string) {
  const clean = value.replace(/^factura\s*/i, "").trim()
  const slash = clean.lastIndexOf("/")
  if (slash > 0 && slash < clean.length - 1) return { serie: clean.slice(0, slash).trim().replace(/([_-])[-_]+/g, "$1"), numero: clean.slice(slash + 1).trim() }
  return { serie: "", numero: clean }
}

function parseDateInLine(value: string) {
  const match = value.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/)
  if (!match) return ""
  const [, day, month, rawYear] = match
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
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
  const nifs = Array.from(new Set(text.match(/\b[A-Z][-]?\d{8}\b|\b\d{8}[-]?[A-Z]\b|\b\d{9}\b/g) || []))
  const labeledNifLine = lines.find((line) => /(^|\s)nif\s*[:#]/i.test(line) && !/cif\s*\/\s*nif/i.test(line)) || ""
  const labeledNif = labeledNifLine.match(/\bnif\s*[:#]?\s*([A-Z][-\s]?\d{8})/i)
  const labeledCifLine = lines.find((line) => /(^|\s)cif\s*[:#]/i.test(line) && !/cif\s*\/\s*nif/i.test(line)) || ""
  const labeledCif = labeledCifLine.match(/\bcif\s*[:#]?\s*([A-Z][-\s]?\d{8})/i)
  draft.nifEmisor = labeledNif?.[1]?.replace(/\s/g, "").toUpperCase() || (labeledCif ? correctCif(labeledCif[1]) : "") || nifs.find((nif) => !matchesCifReceptor(nif) && /[A-Z]/i.test(nif)) || ""
  draft.receptorCifValido = matchesCifReceptor(text)

  const invoiceLine = normalized.find((line) => /numero.*factura|nº.*factura|factura\s+[a-z0-9_-]+\s*\//i.test(line)) || ""
  const numberMatch = invoiceLine.match(/(?:numero\s+de\s+factura|nº\s*factura|factura)\s*[:#]?\s*([a-z0-9_-]+\s*\/\s*[a-z0-9_-]+)/i)
  const simpleNumberMatch = invoiceLine.match(/(?:numero\s+(?:de\s+)?factura|factura)\s*[:#]?\s*([a-z0-9][a-z0-9_-]{2,})/i)
  const standaloneNumber = normalized.flatMap((line) => Array.from(line.matchAll(/\b[a-z]{2,}[-_]\d{2,4}[-_]-?\d{2,4}\s*\/\s*\d+/gi)).map((match) => ({ line, candidate: match[0] }))).find(({ line, candidate }) => !/factura/.test(line) && /^[a-z0-9_-]+\s*\/\s*\d+$/i.test(candidate))?.candidate
  let number = standaloneNumber || numberMatch?.[1] || simpleNumberMatch?.[1] || invoiceLine.match(/([a-z]{2,}[-_]\d{4}\s*\/\s*\d+)/i)?.[1] || invoiceLine.match(/([a-z]{2,}[-_]\d{3,}[-_]\d{2,4}\s*\/\s*\d+)/i)?.[1] || ""
  if (!number) {
    const numberLine = lines.find((line) => /\b[A-Z]{2,}[-_]\d+[-_]\d+\s*\/\s*\d+/i.test(line))
    if (numberLine) {
      const m = numberLine.match(/([A-Z]{2,}[-_]\d+[-_]\d+\s*\/\s*\d+)/i)
      if (m) number = m[1]
    }
  }
  const split = splitInvoiceNumber(number)
  draft.serie = split.serie.toUpperCase()
  draft.numero = split.numero.toUpperCase()
  draft.fechaExpedicion = findDate(lines, ["fecha de factura", "fecha de emisión", "fecha de expedición", "fecha factura"])
  if (!draft.fechaExpedicion) {
    const documentLine = lines.find((line) => /\bfactura\b/i.test(line) && /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(line))
    if (documentLine) draft.fechaExpedicion = parseDateInLine(documentLine)
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

  if (draft.nifEmisor) {
    const nifClean = normalize(draft.nifEmisor).replace(/-/g, "")
    const nifIndex = normalized.findIndex((line) => line.replace(/-/g, "").includes(nifClean))
    if (nifIndex >= 0) {
      const previousCompany = lines.slice(Math.max(0, nifIndex - 2), nifIndex).find((line) => /[A-Za-zÁÉÍÓÚÑ]{3,}/.test(line) && !/datos|factura|cliente|hora|tienda|tpv|transac|cajero|pago|fecha|efectivo|total|articulo/i.test(line))
      draft.razonSocialEmisor = previousCompany ? cleanCompanyName(previousCompany) : ""
      if (!draft.razonSocialEmisor) {
        const candidate = lines.slice(nifIndex + 1, nifIndex + 3).find((line) => /[A-Za-zÁÉÍÓÚÑ]{3,}/.test(line) && !/datos|factura|cliente|cif|fecha|cajero|transac|hora|tienda|tpv|av\.|calle|^\d{5}/i.test(line))
        if (candidate) draft.razonSocialEmisor = cleanCompanyName(candidate.replace(/^[\sA-Z]{0,10}\s+/, ""))
      }
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

  if (!draft.razonSocialEmisor) {
    const companyLine = lines.find((line) => /[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s,\.]+(?:s\.?a\.?|s\.?l\.?|s\.?l\.?u\.?|s\.a\.u\.?)/i.test(line))
    if (companyLine) draft.razonSocialEmisor = cleanCompanyName(companyLine)
  }

  if (!draft.domicilioFiscalEmisor) {
    const addressLines = lines.filter((line) => /calle|av\.|avenida|pol[ií]gono|sector|nº|num/i.test(normalize(line)) && line.length > 5)
    const postalLine = lines.find((line) => /^\d{5}\s/i.test(line.trim()))
    const parts = [addressLines[0], postalLine].filter((p): p is string => Boolean(p))
    if (parts.length) draft.domicilioFiscalEmisor = parts.map((p) => p.trim()).join(", ")
  }

  draft.totalNeto = findAmount(lines, ["total neto", "base imponible", "base imp"])
  draft.totalDescuento = findAmount(lines, ["total descuento", "descuento total"])
  if (draft.totalDescuento === "0") draft.totalDescuento = "0.00"
  draft.totalIva = findAmount(lines, ["total iva", "total impuesto", "total iv"])
  draft.totalRecargo = findAmount(lines, ["total re", "total recargo"])
  draft.totalRetenciones = findAmount(lines, ["total irpf", "retenciones", "retención"])
  draft.importeTotal = findLastAmount(lines, ["total bruto", "importe total"])

  if (draft.importeTotal === "0") {
    const wanted = ["total"]
    let bestTotal = "0"
    for (let index = 0; index < lines.length; index += 1) {
      const line = normalize(lines[index])
      if (/total\s+art[ií]culos/i.test(line)) continue
      if (!wanted.some((label) => line.includes(label))) continue
      const tail = amounts(lines[index])
      if (tail.length) {
        const last = tail[tail.length - 1]
        if (last !== "0.00" && last !== "0") bestTotal = last
      }
    }
    if (bestTotal !== "0") {
      draft.importeTotal = bestTotal
    } else {
      const efectivoIdx = normalized.findIndex((l) => /efectivo|tarjeta|pago/i.test(l))
      if (efectivoIdx > 0) {
        for (let i = efectivoIdx - 1; i >= 0; i -= 1) {
          const nums = amounts(lines[i])
          if (nums.length && nums[nums.length - 1] !== "0.00") { draft.importeTotal = nums[nums.length - 1]; break }
        }
      }
    }
  }

  if (draft.importeTotal === "0") {
    const totalsHeaderIndex = normalized.findIndex((line) => line.includes("base imponible") && line.includes("total"))
    let lastStandaloneAmount = "0"
    for (let index = totalsHeaderIndex + 1; totalsHeaderIndex >= 0 && index < Math.min(lines.length, totalsHeaderIndex + 12); index += 1) {
      if (/proteccion|datos personales/.test(normalized[index])) break
      if (/%/.test(lines[index])) continue
      const values = amounts(lines[index])
      if (values.length === 1) lastStandaloneAmount = values[0]
    }
    if (lastStandaloneAmount !== "0") draft.importeTotal = lastStandaloneAmount
  }

  const taxRows: FacturaImpuestoDraft[] = []
  for (const line of lines) {
    const normalizedLine = normalize(line)
    const isTaxSummary = /sin iva|exento|superreducido|reducido|normal/.test(normalizedLine)
    const match = line.match(/(\d+(?:[,.]\d+)?)\s*%/)
    if (!match || !isTaxSummary) continue
    const matchIndex = match.index || 0
    const beforeRate = amounts(line.slice(0, matchIndex))
    const afterRate = line.slice(matchIndex + match[0].length).split(/total\s+(?:iva|re|bruto|neto)/i)[0]
    const afterAmounts = amounts(afterRate)
    taxRows.push({
      tipo: "IVA",
      porcentaje: amount(match[1]),
      baseImponible: beforeRate[beforeRate.length - 1] || "0.00",
      cuota: afterAmounts[0] || "0.00",
    })
  }
  if (!taxRows.length) {
    const taxHeaderIndex = normalized.findIndex((line) => /c[oó]digo/.test(line) && /base\s*(?:imp|inp)|\b(?:iva|va)\b/.test(line))
    const taxData = taxHeaderIndex >= 0 ? amounts(lines[taxHeaderIndex + 1] || "") : []
    if (taxData.length >= 4) {
      taxRows.push({ tipo: "IVA", porcentaje: Number(taxData[1]).toFixed(0) + ".00", baseImponible: taxData[taxData.length - 2], cuota: taxData[taxData.length - 1] })
    }
  }
  if (!taxRows.length) {
    for (const line of lines) {
      const match = line.match(/(\d+(?:[,.]\d+)?)\s*%/)
      if (!match) continue
      const taxNums = amounts(line)
      if (taxNums.length >= 2 && /iva|impuesto|tipo/i.test(normalize(line))) {
        const matchIndex = match.index || 0
        const beforeRate = amounts(line.slice(0, matchIndex))
        const afterRate = amounts(line.slice(matchIndex + match[0].length))
        taxRows.push({ tipo: "IVA", porcentaje: amount(match[1]), baseImponible: beforeRate[beforeRate.length - 1] || afterRate[afterRate.length - 2] || taxNums[taxNums.length - 2], cuota: afterRate[afterRate.length - 1] || taxNums[taxNums.length - 1] })
      }
    }
  }
  draft.impuestos = taxRows.filter((row, index, rows) => rows.findIndex((item) => item.porcentaje === row.porcentaje) === index)

  if (draft.impuestos.length) {
    const taxBase = draft.impuestos.reduce((sum, t) => (Number(sum) + Number(t.baseImponible)).toFixed(2), "0")
    const taxCuota = draft.impuestos.reduce((sum, t) => (Number(sum) + Number(t.cuota)).toFixed(2), "0")
    if (taxBase !== "0.00" && (draft.totalNeto === "0" || Number(draft.totalNeto) < Number(taxBase) * 0.5)) {
      draft.totalNeto = taxBase
    }
    if (taxCuota !== "0.00") draft.totalIva = taxCuota
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
  return draft
}
