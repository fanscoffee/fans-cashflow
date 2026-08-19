export interface FacturaLineaDraft {
  productoId: string
  tipoLinea: "PRODUCTO" | "CARGO"
  referenciaProveedor: string
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
  formaPago: string
  razonSocialEmisor: string
  nifEmisor: string
  domicilioFiscalEmisor: string
  totalNeto: string
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
    formaPago: "",
    razonSocialEmisor: "",
    nifEmisor: "",
    domicilioFiscalEmisor: "",
    totalNeto: "0",
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

function amount(value: string) {
  const cleaned = value.replace(/[^0-9,.-]/g, "").replace(/\.(?=.*\.)/g, "")
  if (!cleaned) return "0"
  const parsed = Number(cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned)
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0"
}

function amounts(value: string) {
  return (value.match(/[-+]?\d[\d.\s]*(?:,\d+)?/g) || []).map(amount)
}

function findAmount(lines: string[], labels: string[]) {
  const wanted = labels.map(normalize)
  for (let index = 0; index < lines.length; index += 1) {
    const line = normalize(lines[index])
    if (!wanted.some((label) => line.includes(label))) continue
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
  const pattern = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/
  for (let index = 0; index < lines.length; index += 1) {
    if (!wanted.some((label) => normalize(lines[index]).includes(label))) continue
    const match = lines.slice(index, index + 2).join(" ").match(pattern)
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
    const line = normalize(lines[index])
    const label = wanted.find((candidate) => line.includes(candidate))
    if (!label) continue
    const originalIndex = line.indexOf(label)
    const value = lines[index].slice(originalIndex + label.length).replace(/^\s*[:#-]\s*/, "").trim()
    if (value) return value
    if (lines[index + 1]) return lines[index + 1].trim()
  }
  return ""
}

function splitInvoiceNumber(value: string) {
  const clean = value.replace(/^factura\s*/i, "").trim()
  const slash = clean.lastIndexOf("/")
  if (slash > 0 && slash < clean.length - 1) return { serie: clean.slice(0, slash).trim(), numero: clean.slice(slash + 1).trim() }
  return { serie: "", numero: clean }
}

function parseDateInLine(value: string) {
  const match = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
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

export function parseFacturaText(text: string): FacturaDraft {
  const draft = emptyFacturaDraft()
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const normalized = lines.map(normalize)
  const nifs = Array.from(new Set(text.match(/\b[A-Z]\d{8}\b|\b\d{8}[A-Z]\b/g) || []))
  draft.nifEmisor = nifs.find((nif) => normalize(nif) !== "b09711078") || ""
  draft.receptorCifValido = normalize(text).includes("b09711078")

  const invoiceLine = lines.find((line) => /numero.*factura|nº.*factura|factura\s+[A-Z0-9_-]+\s*\//i.test(line)) || ""
  const numberMatch = invoiceLine.match(/(?:numero\s+de\s+factura|nº\s*factura|factura)\s*[:#]?\s*([A-Z0-9_-]+\s*\/\s*[A-Z0-9_-]+)/i)
  const number = numberMatch?.[1] || invoiceLine.match(/([A-Z]{2,}[-_]\d{4}\s*\/\s*\d+)/i)?.[1] || ""
  const split = splitInvoiceNumber(number)
  draft.serie = split.serie
  draft.numero = split.numero
  draft.fechaExpedicion = findDate(lines, ["fecha de factura", "fecha de emisión", "fecha de expedición", "fecha factura"])
  draft.fechaOperacion = findDate(lines, ["fecha de operación", "fecha operacion"])
  draft.fechaVencimiento = findDate(lines, ["vencimiento", "fecha de pago"])
  draft.formaPago = findValue(lines, ["forma de pago", "forma pago"])

  if (draft.nifEmisor) {
    const nifIndex = normalized.findIndex((line) => line.includes(normalize(draft.nifEmisor)))
    draft.razonSocialEmisor = lines.slice(Math.max(0, nifIndex - 2), nifIndex).find((line) => /[A-Za-zÁÉÍÓÚÑ]{3,}/.test(line) && !/datos|factura|cliente/i.test(line)) || ""
    draft.domicilioFiscalEmisor = lines.slice(nifIndex + 1, nifIndex + 4).filter((line) => line.length > 8 && !/datos|cliente|fecha|número|numero/i.test(line)).join(", ")
  }

  draft.totalNeto = findAmount(lines, ["total neto", "base imponible"])
  draft.totalIva = findAmount(lines, ["total iva", "total impuesto"])
  draft.totalRecargo = findAmount(lines, ["total re", "total recargo"])
  draft.totalRetenciones = findAmount(lines, ["total irpf", "retenciones", "retención"])
  draft.importeTotal = findLastAmount(lines, ["total bruto", "importe total", "total"])

  const taxRows: FacturaImpuestoDraft[] = []
  for (const line of lines) {
    const match = line.match(/(?:iva|impuesto)\s*(?:pan\s*)?(\d+(?:[,.]\d+)?)\s*%/i)
    if (match) taxRows.push({ tipo: "IVA", porcentaje: amount(match[1]), baseImponible: "0", cuota: "0" })
  }
  draft.impuestos = taxRows.filter((row, index, rows) => rows.findIndex((item) => item.porcentaje === row.porcentaje) === index)

  for (let index = 0; index < lines.length; index += 1) {
    const parsed = parseYolmarLine(lines[index], lines[index + 1] || "") || parseGenericLine(lines[index])
    if (parsed) draft.lineas.push(parsed)
  }
  if (draft.lineas.length > 1 && draft.lineas[0].descripcion === "") draft.lineas.shift()
  return draft
}
