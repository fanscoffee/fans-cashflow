"use client"

import { useRef, useState } from "react"
import { extractDocument } from "@/lib/document-ocr"
import { parseInvoiceText } from "@/lib/invoice-ocr"
import {
  buildAccountingAmountWarnings,
  emptyAccountingInvoice,
  invoiceDraftToAccounting,
  type AccountingInvoiceFormData,
} from "@/lib/accounting-invoices"

function numberValue(value: string) {
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : 0
}

function Input({ id, label, value, onChange, type = "text", required = false, error = false }: { id?: string; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; error?: boolean }) {
  return <label className="block text-xs text-gray-600"><span className="mb-1 block font-medium">{label}{required ? " *" : ""}</span><input id={id} type={type} min={type === "number" ? "0" : undefined} step={type === "number" ? "0.01" : undefined} value={value} onChange={(event) => onChange(event.target.value)} className={`w-full rounded-md border px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 ${error ? "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"}`} aria-invalid={error || undefined} /></label>
}

const TAX_FIELDS = [
  { rate: "21", base: "base21", vat: "vat21" },
  { rate: "10", base: "base10", vat: "vat10" },
  { rate: "4", base: "base4", vat: "vat4" },
  { rate: "2", base: "base2", vat: "vat2" },
] as const

export default function AccountingInvoiceForm({ initialValues, onCancel, onSubmit, saving }: { initialValues?: AccountingInvoiceFormData; onCancel: () => void; onSubmit: (data: AccountingInvoiceFormData) => Promise<boolean>; saving: boolean }) {
  const [data, setData] = useState<AccountingInvoiceFormData>(initialValues || emptyAccountingInvoice())
  const [ocrStatus, setOcrStatus] = useState("")
  const [ocrError, setOcrError] = useState("")
  const [documentRead, setDocumentRead] = useState(initialValues?.source === "OCR")
  const [submitted, setSubmitted] = useState(false)
  const [ocrCopied, setOcrCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function update<K extends keyof AccountingInvoiceFormData>(field: K, value: AccountingInvoiceFormData[K]) {
    setData((current) => ({ ...current, [field]: value }))
  }

  async function handleFile(file: File) {
    setOcrError("")
    setOcrStatus("Procesando documento...")
    try {
      const text = await extractDocument(file, setOcrStatus, "spa+eng")
      if (!text.trim()) throw new Error("El documento no contiene texto legible")
      setData(invoiceDraftToAccounting(parseInvoiceText(text), text))
      setDocumentRead(true)
      setOcrStatus("Documento leído. Revisa los datos antes de guardar.")
    } catch {
      setOcrError("No se pudo leer el documento. Completa o corrige los datos manualmente.")
      setOcrStatus("")
    }
  }

  async function copyOcrText() {
    if (!data.ocrText) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.ocrText)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = data.ocrText
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        const copied = document.execCommand("copy")
        textarea.remove()
        if (!copied) throw new Error("No se pudo copiar")
      }
      setOcrCopied(true)
      window.setTimeout(() => setOcrCopied(false), 2000)
    } catch {
      setOcrError("No se pudo copiar el texto OCR")
    }
  }

  const missingDate = !data.date
  const missingTotal = data.invoiceTotal.trim() === ""
  const missing = [missingDate ? "Fecha" : "", missingTotal ? "Total factura" : ""].filter(Boolean)
  const warnings = buildAccountingAmountWarnings({
    exemptBase: numberValue(data.exemptBase),
    base21: numberValue(data.base21),
    base10: numberValue(data.base10),
    base4: numberValue(data.base4),
    base2: numberValue(data.base2),
    totalBase: numberValue(data.totalBase),
    totalVat: numberValue(data.totalVat),
    withholdingTax: numberValue(data.withholdingTax),
    invoiceTotal: numberValue(data.invoiceTotal),
  })

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    if (missing.length > 0) return
    await onSubmit(data)
  }

  return <form onSubmit={submit} className="space-y-5">
    <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">Leer PDF / imagen</button>
        <input ref={fileInputRef} type="file" accept=".pdf,application/pdf,image/*" className="hidden" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void handleFile(file) }} />
        {documentRead && <span className="text-xs text-green-800">Documento leído</span>}
      </div>
      <p className="mt-1 text-xs text-blue-800">OCR local. No se conserva el archivo original. Se guardan datos y texto reconocido.</p>
      {ocrStatus && <p className="mt-1 text-xs text-blue-800">{ocrStatus}</p>}
      {ocrError && <p className="mt-1 text-xs text-red-700">{ocrError}</p>}
    </div>

    {submitted && missing.length > 0 && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">Faltan: {missing.join(", ")}</div>}
    {warnings.map((warning) => <div key={warning} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{warning}</div>)}

    <section>
      <h3 className="mb-2 text-sm font-semibold text-gray-900">Identificación</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input id="gestoria-fecha" label="Fecha" type="date" value={data.date} onChange={(value) => update("date", value)} required error={submitted && missingDate} />
        <Input label="Factura Nº" value={data.invoiceNumber} onChange={(value) => update("invoiceNumber", value)} />
        <Input id="gestoria-proveedor" label="Proveedor / acreedor (opcional)" value={data.supplierOrCreditor} onChange={(value) => update("supplierOrCreditor", value)} />
        <Input label="NIF" value={data.taxId} onChange={(value) => update("taxId", value.toUpperCase())} />
        <Input label="Concepto" value={data.concept} onChange={(value) => update("concept", value)} />
        <Input label="Forma pago" value={data.paymentMethod} onChange={(value) => update("paymentMethod", value)} />
      </div>
    </section>

    <section>
      <h3 className="mb-2 text-sm font-semibold text-gray-900">Impuestos</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Base exenta / 0%" type="number" value={data.exemptBase} onChange={(value) => update("exemptBase", value)} />
        {TAX_FIELDS.map((tax) => <div key={tax.rate} className="grid grid-cols-2 gap-2 rounded-md border border-gray-200 p-2"><Input label={`Base ${tax.rate}%`} type="number" value={data[tax.base]} onChange={(value) => update(tax.base, value)} /><Input label={`IVA ${tax.rate}%`} type="number" value={data[tax.vat]} onChange={(value) => update(tax.vat, value)} /></div>)}
      </div>
    </section>

    <section>
      <h3 className="mb-2 text-sm font-semibold text-gray-900">Totales</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Input label="Total base imponible" type="number" value={data.totalBase} onChange={(value) => update("totalBase", value)} />
        <Input label="Total cuota IVA" type="number" value={data.totalVat} onChange={(value) => update("totalVat", value)} />
        <Input label="IRPF" type="number" value={data.withholdingTax} onChange={(value) => update("withholdingTax", value)} />
        <Input id="gestoria-total" label="Total factura" type="number" value={data.invoiceTotal} onChange={(value) => update("invoiceTotal", value)} required error={submitted && missingTotal} />
      </div>
    </section>

    {data.ocrText && <details className="rounded-md border border-gray-200 p-3"><summary className="cursor-pointer text-sm font-medium text-gray-800">Texto OCR guardado</summary><div className="mt-2 flex flex-wrap items-center gap-2"><button type="button" onClick={() => void copyOcrText()} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">{ocrCopied ? "Copiado" : "Copiar texto"}</button></div><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-gray-600">{data.ocrText}</pre></details>}

    <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
      <button type="button" onClick={onCancel} className="rounded-md border px-3 py-2 text-sm text-gray-700">Cancelar</button>
      <button type="submit" disabled={saving} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Guardando..." : "Guardar factura"}</button>
    </div>
  </form>
}
