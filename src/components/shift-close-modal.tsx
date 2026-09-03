"use client"

import { useMemo, useRef, useState } from "react"
import { createWorker, PSM } from "tesseract.js"
import type { ShiftClose, Shift } from "@/types/shift"
import { toN } from "@/lib/money"

const NUMERIC_FIELDS = [
  "previousCashFund",
  "cashReceipts",
  "cashRefunds",
  "depositedAmount",
  "paymentOutflows",
  "theoreticalCash",
  "actualCash",
  "cashVariance",
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

export interface ShiftCloseFormData {
  cashCloseNumber: string
  pos: string
  openingDateTime: string
  closingDateTime: string
  previousCashFund: string
  cashReceipts: string
  cashRefunds: string
  depositedAmount: string
  paymentOutflows: string
  theoreticalCash: string
  actualCash: string
  cashVariance: string
  grossSales: string
  refunds: string
  discounts: string
  netSales: string
  cashSales: string
  cardSales: string
  breadVat4Base: string
  breadVat4Amount: string
  vat10Base: string
  vat10Amount: string
  varianceNote: string
  cash: string
  caixaBankAmount: string
  santanderAmount: string
  noInformation?: boolean
}

const EMPTY_FIELDS: ShiftCloseFormData = {
  cashCloseNumber: "",
  pos: "",
  openingDateTime: "",
  closingDateTime: "",
  previousCashFund: "",
  cashReceipts: "",
  cashRefunds: "",
  depositedAmount: "",
  paymentOutflows: "",
  theoreticalCash: "",
  actualCash: "",
  cashVariance: "",
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
  varianceNote: "",
  cash: "",
  caixaBankAmount: "",
  santanderAmount: "",
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
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

function currencyValues(lines: string[], start = 0, end = lines.length) {
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
    if (sameLine.length > 0) return parseAmount(sameLine[sameLine.length - 1]) || "0.00"

    for (let next = index + 1; next < Math.min(index + 3, end); next += 1) {
      const nextTokens = amountTokens(lines[next])
      if (nextTokens.length > 0) return parseAmount(nextTokens[nextTokens.length - 1]) || "0.00"
    }
    return "0.00"
  }
  return "0.00"
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

function localDateTime(value: string | Date) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
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

function extractTicket(text: string): ShiftCloseFormData {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const normalizedLines = lines.map(normalizeText)
  const summaryStart = normalizedLines.findIndex((line) => line.includes("resumen de ventas"))
  const taxesStart = normalizedLines.findIndex((line) => line === "impuestos" || line.includes("impuestos"))
  const summaryFrom = summaryStart >= 0 ? summaryStart : 0
  const summaryTo = taxesStart > summaryFrom ? taxesStart : lines.length
  const fields = { ...EMPTY_FIELDS }

  fields.cashCloseNumber = textAfterLabel(lines, "Número de cierre de caja") || textAfterLabel(lines, "Numero de cierre de caja")
  fields.pos = textAfterLabel(lines, "TPV")
  fields.openingDateTime = dateTimeFromLabel(lines, "Apertura del turno")
  fields.closingDateTime = dateTimeFromLabel(lines, "Cerrado")

  fields.previousCashFund = amountFromLabel(lines, "Fondo de caja anterior")
  fields.cashReceipts = amountFromLabel(lines, "Cobros en efectivo")
  fields.cashRefunds = amountFromLabel(lines, "Reembolsos en efectivo")
  fields.depositedAmount = amountFromLabel(lines, "Depositado")
  fields.paymentOutflows = amountFromLabel(lines, "Pagos/Salidas")
  fields.theoreticalCash = amountFromLabel(lines, "Efectivo teórico en caja")
  fields.actualCash = amountFromLabel(lines, "Cantidad de efectivo real")
  fields.cashVariance = amountFromLabel(lines, "Descuadre")

  fields.grossSales = amountFromLabel(lines, "Ventas brutas", summaryFrom, summaryTo)
  fields.refunds = amountFromLabel(lines, "Reembolsos", summaryFrom, summaryTo)
  fields.discounts = amountFromLabel(lines, "Descuentos", summaryFrom, summaryTo)
  fields.netSales = amountFromLabel(lines, "Ventas netas", summaryFrom, summaryTo)
  fields.cashSales = amountFromLabel(lines, "Efectivo", summaryFrom, summaryTo)
  fields.cardSales = amountFromLabel(lines, "Por tarjeta", summaryFrom, summaryTo)

  const summaryValues = currencyValues(lines, summaryFrom, summaryTo)
  if (summaryValues.length >= 6) {
    [fields.grossSales, fields.refunds, fields.discounts, fields.netSales, fields.cashSales, fields.cardSales] = summaryValues.slice(0, 6)
  }

  const taxesFrom = taxesStart >= 0 ? taxesStart : lines.length
  fields.breadVat4Base = amountFromLabel(lines, "IVA Pan, 4% base imp", taxesFrom)
  fields.breadVat4Amount = amountFromLabel(lines, "IVA Pan, 4% cuota", taxesFrom)
  fields.vat10Base = amountFromLabel(lines, "IVA, 10% base imp", taxesFrom)
  fields.vat10Amount = amountFromLabel(lines, "IVA, 10% cuota", taxesFrom)

  const taxValues = currencyValues(lines, taxesFrom)
  if (taxValues.length >= 4) {
    [fields.breadVat4Base, fields.breadVat4Amount, fields.vat10Base, fields.vat10Amount] = taxValues.slice(0, 4)
  } else if (taxValues.length === 2) {
    [fields.vat10Base, fields.vat10Amount] = taxValues
  }

  fields.cash = fields.cashSales
  return fields
}

function mergeOcrFields(primary: ShiftCloseFormData, secondary: ShiftCloseFormData) {
  const merged = { ...primary }
  for (const field of NUMERIC_FIELDS) {
    if (toN(merged[field]) === 0 && toN(secondary[field]) !== 0) merged[field] = secondary[field]
  }
  for (const field of ["cashCloseNumber", "pos", "openingDateTime", "closingDateTime"] as const) {
    if (!merged[field].trim() && secondary[field].trim()) merged[field] = secondary[field]
  }
  merged.cash = merged.cashSales
  return merged
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  allowNegative = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: "text" | "number" | "datetime-local"
  required?: boolean
  allowNegative?: boolean
}) {
  return (
    <label className="block text-xs text-gray-600">
      <span className="mb-1 block font-medium">{label}{required ? " *" : ""}</span>
      <input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" && !allowNegative ? "0" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </label>
  )
}

export default function ShiftCloseModal({
  shift,
  initialClose,
  requirePhoto = true,
  onCancel,
  onSubmit,
  saving,
}: {
  shift: Shift
  initialClose?: ShiftClose | null
  requirePhoto?: boolean
  onCancel: () => void
  onSubmit: (data: ShiftCloseFormData) => Promise<void | boolean>
  saving: boolean
}) {
  const [fields, setFields] = useState<ShiftCloseFormData>(() => {
    if (!initialClose) {
      return {
        ...EMPTY_FIELDS,
        cash: String(toN(shift.cash)),
        caixaBankAmount: String(toN(shift.caixaBankAmount)),
        santanderAmount: String(toN(shift.santanderAmount)),
      }
    }

    const values = initialClose as unknown as Record<string, string | number | null>
    const initial = { ...EMPTY_FIELDS } as Omit<ShiftCloseFormData, "noInformation">
    for (const key of Object.keys(initial) as (keyof typeof initial)[]) {
      if (key in values && values[key] != null) initial[key] = String(values[key])
    }
    initial.openingDateTime = localDateTime(initialClose.openingDateTime)
    initial.closingDateTime = localDateTime(initialClose.closingDateTime)
    initial.cash = String(toN(shift.cash))
    initial.caixaBankAmount = String(toN(shift.caixaBankAmount))
    initial.santanderAmount = String(toN(shift.santanderAmount))
    return initial
  })
  const [ocrStatus, setOcrStatus] = useState("")
  const [ocrError, setOcrError] = useState("")
  const [ocrCompleted, setOcrCompleted] = useState(false)
  const [fileName, setFileName] = useState("")
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const updateField = (field: keyof ShiftCloseFormData, value: string) => {
    setFields((previous) => ({ ...previous, [field]: value }))
  }

  async function handleImage(file: File) {
    setFileName(file.name)
    setOcrError("")
    setOcrCompleted(false)
    setOcrStatus("Preparando lectura...")

    try {
      const worker = await createWorker("spa", 1, {
        logger: (message) => {
          if (message.status) {
            setOcrStatus(`${message.status} ${Math.round(message.progress * 100)}%`)
          }
        },
      })
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1" })
      const blockResult = await worker.recognize(file)
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN, preserve_interword_spaces: "1" })
      const columnResult = await worker.recognize(file)
      await worker.terminate()
      setFields({
        ...mergeOcrFields(extractTicket(blockResult.data.text), extractTicket(columnResult.data.text)),
        caixaBankAmount: String(toN(shift.caixaBankAmount)),
        santanderAmount: String(toN(shift.santanderAmount)),
      })
      setOcrCompleted(true)
      setOcrStatus("Lectura completada. Revisa todos los campos antes de confirmar.")
    } catch {
      setOcrError("No se pudo leer la imagen. Sube una foto más nítida o completa los campos manualmente.")
      setOcrStatus("")
    }
  }

  const missingFields = useMemo(() => {
    const missing: string[] = []
    for (const field of NUMERIC_FIELDS) {
      if (fields[field].trim() === "") missing.push(field)
    }
    if (!fields.cashCloseNumber.trim()) missing.push("cashCloseNumber")
    if (!fields.pos.trim()) missing.push("pos")
    if (!fields.openingDateTime.trim()) missing.push("openingDateTime")
    if (!fields.closingDateTime.trim()) missing.push("closingDateTime")
    if (fields.cash.trim() === "") missing.push("cash")
    if (fields.caixaBankAmount.trim() === "") missing.push("caixaBankAmount")
    if (fields.santanderAmount.trim() === "") missing.push("santanderAmount")
    return missing
  }, [fields])

  const cashDifference = toN(fields.cash) - toN(fields.cashSales)
  const tarjetaDifference = toN(fields.caixaBankAmount) + toN(fields.santanderAmount) - toN(fields.cardSales)
  const hasPaymentDifference = Math.abs(cashDifference) > 0.009 || Math.abs(tarjetaDifference) > 0.009
  const canConfirm = (ocrCompleted || !requirePhoto) && missingFields.length === 0 && (!hasPaymentDifference || fields.varianceNote.trim().length > 0)

  async function handleSubmit() {
    if (!canConfirm) return
    await onSubmit(fields)
  }

  async function handleQuickClose() {
    if (!confirm("¿Cerrar el turno sin registrar información del ticket?")) return
    await onSubmit({ ...EMPTY_FIELDS, noInformation: true })
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:p-4">
      <div className="mx-auto max-w-5xl rounded-lg bg-white p-4 shadow-xl sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Cierre de turno</h2>
            <p className="text-sm text-gray-500">
              {new Date(shift.date).toLocaleDateString("es-ES")} — {shift.shift}
            </p>
          </div>
          <button type="button" onClick={onCancel} className="min-h-11 shrink-0 rounded-md px-2 text-gray-500 hover:text-gray-800">Cerrar</button>
        </div>

        {requirePhoto ? (
          <div className="mb-4 rounded-md border border-blue-100 bg-blue-50 p-3">
            <p className="text-sm font-medium text-blue-900">Carga el ticket de cierre</p>
            <p className="mt-1 text-xs text-blue-800">La imagen se procesa en este dispositivo y no se conserva.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => cameraInputRef.current?.click()} className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">
                Tomar foto
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-md border border-blue-300 px-3 py-2 text-xs font-medium text-blue-800 hover:bg-blue-100">
                Seleccionar imagen
              </button>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => event.target.files?.[0] && handleImage(event.target.files[0])} />
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && handleImage(event.target.files[0])} />
            </div>
            {fileName && <p className="mt-2 break-words text-xs text-gray-600 [overflow-wrap:anywhere]">Imagen procesada: {fileName}</p>}
            {ocrStatus && <p className="mt-2 text-xs text-blue-800">{ocrStatus}</p>}
            {ocrError && <p className="mt-2 text-xs text-red-600">{ocrError}</p>}
          </div>
        ) : (
          <div className="mb-4 rounded-md border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
            Turno reabierto por un socio. Puedes corregir los datos confirmados sin volver a cargar la foto.
          </div>
        )}

        <div className="space-y-4">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Identificación</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <InputField label="Número de cierre" value={fields.cashCloseNumber} onChange={(value) => updateField("cashCloseNumber", value)} />
              <InputField label="TPV" value={fields.pos} onChange={(value) => updateField("pos", value)} />
              <InputField label="Apertura ticket" type="datetime-local" value={fields.openingDateTime} onChange={(value) => updateField("openingDateTime", value)} />
              <InputField label="Cierre ticket" type="datetime-local" value={fields.closingDateTime} onChange={(value) => updateField("closingDateTime", value)} />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Cajón de efectivo</h3>
            <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:grid-cols-4">
              <InputField label="Fondo caja anterior" type="number" value={fields.previousCashFund} onChange={(value) => updateField("previousCashFund", value)} />
              <InputField label="Cobros en efectivo" type="number" value={fields.cashReceipts} onChange={(value) => updateField("cashReceipts", value)} />
              <InputField label="Reembolsos efectivo" type="number" value={fields.cashRefunds} onChange={(value) => updateField("cashRefunds", value)} />
              <InputField label="Depositado" type="number" value={fields.depositedAmount} onChange={(value) => updateField("depositedAmount", value)} />
              <InputField label="Pagos / salidas" type="number" value={fields.paymentOutflows} onChange={(value) => updateField("paymentOutflows", value)} />
              <InputField label="Efectivo teórico" type="number" value={fields.theoreticalCash} onChange={(value) => updateField("theoreticalCash", value)} />
              <InputField label="Efectivo real" type="number" value={fields.actualCash} onChange={(value) => updateField("actualCash", value)} />
              <InputField label="Descuadre ticket" type="number" allowNegative value={fields.cashVariance} onChange={(value) => updateField("cashVariance", value)} />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Resumen de ventas</h3>
            <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:grid-cols-4">
              <InputField label="Ventas brutas" type="number" value={fields.grossSales} onChange={(value) => updateField("grossSales", value)} />
              <InputField label="Reembolsos" type="number" value={fields.refunds} onChange={(value) => updateField("refunds", value)} />
              <InputField label="Descuentos" type="number" value={fields.discounts} onChange={(value) => updateField("discounts", value)} />
              <InputField label="Ventas netas" type="number" value={fields.netSales} onChange={(value) => updateField("netSales", value)} />
              <InputField label="Efectivo ticket" type="number" value={fields.cashSales} onChange={(value) => { updateField("cashSales", value); updateField("cash", value) }} />
              <InputField label="Por tarjeta ticket" type="number" value={fields.cardSales} onChange={(value) => updateField("cardSales", value)} />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Impuestos</h3>
            <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:grid-cols-4">
              <InputField label="IVA Pan 4% — base" type="number" value={fields.breadVat4Base} onChange={(value) => updateField("breadVat4Base", value)} />
              <InputField label="IVA Pan 4% — cuota" type="number" value={fields.breadVat4Amount} onChange={(value) => updateField("breadVat4Amount", value)} />
              <InputField label="IVA 10% — base" type="number" value={fields.vat10Base} onChange={(value) => updateField("vat10Base", value)} />
              <InputField label="IVA 10% — cuota" type="number" value={fields.vat10Amount} onChange={(value) => updateField("vat10Amount", value)} />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Control de importes actuales</h3>
            <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:grid-cols-4">
              <InputField label="Efectivo del turno" type="number" value={fields.cash} onChange={(value) => updateField("cash", value)} />
              <InputField label="Caixa" type="number" value={fields.caixaBankAmount} onChange={(value) => updateField("caixaBankAmount", value)} />
              <InputField label="Santander" type="number" value={fields.santanderAmount} onChange={(value) => updateField("santanderAmount", value)} />
            </div>
            {hasPaymentDifference && (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">Hay un descuadre con el ticket.</p>
                <p>Efectivo: {cashDifference.toFixed(2)} € · Tarjeta: {tarjetaDifference.toFixed(2)} €</p>
                <label className="mt-2 block text-xs font-medium">
                  Observación obligatoria
                  <textarea value={fields.varianceNote} onChange={(event) => updateField("varianceNote", event.target.value)} className="mt-1 min-h-20 w-full rounded-md border border-amber-300 px-2 py-1.5 text-sm text-gray-900" />
                </label>
              </div>
            )}
          </section>
        </div>

        {missingFields.length > 0 && ocrCompleted && (
          <p className="mt-4 rounded-md bg-red-50 p-3 text-xs text-red-700">Completa todos los campos pendientes antes de confirmar.</p>
        )}
        {!ocrCompleted && requirePhoto && <p className="mt-4 rounded-md bg-amber-50 p-3 text-xs text-amber-800">La foto es obligatoria. Carga el ticket para rellenar los datos automáticamente.</p>}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto">Cancelar</button>
          <button type="button" onClick={handleQuickClose} disabled={saving} className="w-full rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
            {saving ? "Cerrando..." : "Cerrar turno sin información"}
          </button>
          <button type="button" onClick={handleSubmit} disabled={!canConfirm || saving} className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
            {saving ? "Guardando..." : "Confirmar y cerrar turno"}
          </button>
        </div>
      </div>
    </div>
  )
}
