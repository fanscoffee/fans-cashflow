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

function normalizeAlpha(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "").trim()
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

function parseIkeaReceiptLine(lines: string[], index: number) {
  const refMatch = lines[index].match(/Art\/\s*EA\s+(\d+)/i)
  if (!refMatch) return null
  const draft = emptyFacturaLinea()
  draft.tipoLinea = "PRODUCTO"
  draft.referenciaProveedor = refMatch[1]
  const descLine = (lines[index + 1] || "").trim()
  const priceLine = (lines[index + 2] || "").trim()
  draft.descripcion = descLine || ""
  const nums = amounts(priceLine)
  if (nums.length >= 3) {
    draft.cantidad = nums[0]
    draft.precioUnitario = nums[1]
    draft.precioUnitarioNeto = nums[1]
    draft.baseImponible = nums[2]
  } else if (nums.length === 2) {
    draft.cantidad = "1.00"
    draft.precioUnitario = nums[0]
    draft.precioUnitarioNeto = nums[0]
    draft.baseImponible = nums[1]
  } else if (nums.length === 1) {
    draft.cantidad = "1.00"
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
  draft.nifEmisor = nifs.find((nif) => !matchesCifReceptor(nif)) || ""
  draft.receptorCifValido = matchesCifReceptor(text)

  const invoiceLine = lines.find((line) => /numero.*factura|nº.*factura|factura\s+[A-Z0-9_-]+\s*\//i.test(line)) || ""
  const numberMatch = invoiceLine.match(/(?:numero\s+de\s+factura|nº\s*factura|factura)\s*[:#]?\s*([A-Z0-9_-]+\s*\/\s*[A-Z0-9_-]+)/i)
  let number = numberMatch?.[1] || invoiceLine.match(/([A-Z]{2,}[-_]\d{4}\s*\/\s*\d+)/i)?.[1] || invoiceLine.match(/([A-Z]{2,}[-_]\d{3,}[-_]\d{2,4}\s*\/\s*\d+)/i)?.[1] || ""
  if (!number) {
    const numberLine = lines.find((line) => /\b[A-Z]{2,}[-_]\d+[-_]\d+\s*\/\s*\d+/i.test(line))
    if (numberLine) {
      const m = numberLine.match(/([A-Z]{2,}[-_]\d+[-_]\d+\s*\/\s*\d+)/i)
      if (m) number = m[1]
    }
  }
  const split = splitInvoiceNumber(number)
  draft.serie = split.serie
  draft.numero = split.numero
  draft.fechaExpedicion = findDate(lines, ["fecha de factura", "fecha de emisión", "fecha de expedición", "fecha factura"])
  draft.fechaOperacion = findDate(lines, ["fecha de operación", "fecha operacion"])
  draft.fechaVencimiento = findDate(lines, ["vencimiento", "fecha de pago"])
  draft.formaPago = findValue(lines, ["forma de pago", "forma pago"])

  if (draft.nifEmisor) {
    const nifClean = normalize(draft.nifEmisor).replace(/-/g, "")
    const nifIndex = normalized.findIndex((line) => line.replace(/-/g, "").includes(nifClean))
    if (nifIndex >= 0) {
      draft.razonSocialEmisor = lines.slice(Math.max(0, nifIndex - 2), nifIndex).find((line) => /[A-Za-zÁÉÍÓÚÑ]{3,}/.test(line) && !/datos|factura|cliente|hora|tienda|tpv|transac|cajero|pago|fecha|efectivo|total|articulo/i.test(line)) || ""
      if (!draft.razonSocialEmisor) {
        const candidate = lines.slice(nifIndex + 1, nifIndex + 3).find((line) => /[A-Za-zÁÉÍÓÚÑ]{3,}/.test(line) && !/datos|factura|cliente|cif|fecha|cajero|transac|hora|tienda|tpv|av\.|calle|^\d{5}/i.test(line))
        if (candidate) draft.razonSocialEmisor = candidate.replace(/^[\sA-Z]{0,10}\s+/, "").replace(/\s{2,}/g, " ").trim()
      }
      draft.domicilioFiscalEmisor = lines.slice(nifIndex + 1, nifIndex + 4).filter((line) => line.length > 8 && line.length < 80 && !/datos|cliente|fecha|número|numero|cif|cajero|transac|hora|tienda|tpv|razon|denominacion|social|pol[ií]tica|devoluc|consulta|web|ticket|gracias|compra|punto|opini/i.test(line)).join(", ")
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
    if (companyLine) draft.razonSocialEmisor = companyLine.trim()
  }

  if (!draft.domicilioFiscalEmisor) {
    const addressLines = lines.filter((line) => /calle|av\.|avenida|pol[ií]gono|sector|nº|num/i.test(normalize(line)) && line.length > 5)
    const postalLine = lines.find((line) => /^\d{5}\s/i.test(line.trim()))
    const parts = [addressLines[0], postalLine].filter((p): p is string => Boolean(p))
    if (parts.length) draft.domicilioFiscalEmisor = parts.map((p) => p.trim()).join(", ")
  }

  draft.totalNeto = findAmount(lines, ["total neto", "base imponible", "base imp"])
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

  const taxRows: FacturaImpuestoDraft[] = []
  for (const line of lines) {
    const match = line.match(/(\d+(?:[,.]\d+)?)\s*%/)
    if (match && /iva|impuesto|tipo/i.test(normalize(line))) {
      const taxNums = amounts(line)
      const baseAmount = taxNums.length >= 2 ? taxNums[taxNums.length - 2] : "0"
      const cuotaAmount = taxNums.length >= 1 ? taxNums[taxNums.length - 1] : "0"
      taxRows.push({ tipo: "IVA", porcentaje: amount(match[1]), baseImponible: baseAmount, cuota: cuotaAmount })
    }
  }
  if (!taxRows.length) {
    for (const line of lines) {
      const match = line.match(/(\d+(?:[,.]\d+)?)\s*%/)
      if (match && /21|10|4|21,0|10,0|4,0/.test(match[1])) {
        const taxNums = amounts(line)
        if (taxNums.length >= 3) {
          taxRows.push({ tipo: "IVA", porcentaje: amount(match[1]), baseImponible: taxNums[taxNums.length - 2], cuota: taxNums[taxNums.length - 1] })
        }
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
    if (taxCuota !== "0.00" && draft.totalIva === "0") {
      draft.totalIva = taxCuota
    }
  }

  let hasIkeaReceipt = false
  for (let index = 0; index < lines.length; index += 1) {
    if (/art\/\s*ea/i.test(lines[index])) hasIkeaReceipt = true
  }

  for (let index = 0; index < lines.length; index += 1) {
    const parsed = parseYolmarLine(lines[index], lines[index + 1] || "") || parseGenericLine(lines[index]) || (hasIkeaReceipt ? parseIkeaReceiptLine(lines, index) : null)
    if (parsed) draft.lineas.push(parsed)
  }
  if (draft.lineas.length > 1 && draft.lineas[0].descripcion === "") draft.lineas.shift()
  return draft
}
