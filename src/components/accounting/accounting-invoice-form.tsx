"use client"

import { useEffect, useRef, useState } from "react"
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

function Input({ id, label, value, onChange, type = "text", required = false, error = false, readOnly = false }: { id?: string; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; error?: boolean; readOnly?: boolean }) {
  return <label className="block text-xs text-gray-600"><span className="mb-1 block font-medium">{label}{required ? " *" : ""}</span><input id={id} type={type} min={type === "number" ? "0" : undefined} step={type === "number" ? "0.01" : undefined} value={value} onChange={(event) => onChange(event.target.value)} readOnly={readOnly} className={`w-full rounded-md border px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 ${error ? "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500" : readOnly ? "border-gray-300 bg-gray-50 focus:border-gray-300 focus:ring-gray-300" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"}`} aria-invalid={error || undefined} aria-readonly={readOnly || undefined} /></label>
}

interface SupplierOption {
  id: string
  legalName: string
  taxId: string
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
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([])
  const [supplierSearch, setSupplierSearch] = useState("")
  const [supplierMenuOpen, setSupplierMenuOpen] = useState(false)
  const [supplierLoading, setSupplierLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function update<K extends keyof AccountingInvoiceFormData>(field: K, value: AccountingInvoiceFormData[K]) {
    setData((current) => ({ ...current, [field]: value }))
  }

  function updateTaxBase(tax: (typeof TAX_FIELDS)[number], value: string) {
    setData((current) => ({
      ...current,
      [tax.base]: value,
      [tax.vat]: current.source === "MANUAL" ? (numberValue(value) * Number(tax.rate) / 100).toFixed(2) : current[tax.vat],
    }))
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const query = supplierSearch.trim()
    if (!query) {
      setSupplierOptions([])
      setSupplierLoading(false)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setSupplierLoading(true)
      try {
        const params = new URLSearchParams({ search: query })
        const response = await fetch(`/api/gestoria/proveedores?${params.toString()}`, { signal: controller.signal })
        if (!response.ok) throw new Error("No se pudieron cargar los proveedores")
        const result = await response.json() as { suppliers?: SupplierOption[] }
        setSupplierOptions(result.suppliers || [])
        setSupplierMenuOpen(true)
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return
        setSupplierOptions([])
      } finally {
        if (!controller.signal.aborted) setSupplierLoading(false)
      }
    }, 200)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [supplierSearch])
  /* eslint-enable react-hooks/set-state-in-effect */

  function selectSupplier(supplier: SupplierOption) {
    update("supplierOrCreditor", supplier.legalName)
    update("taxId", supplier.taxId.toUpperCase())
    setSupplierSearch("")
    setSupplierOptions([])
    setSupplierMenuOpen(false)
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
        <div
          className="relative grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSupplierMenuOpen(false)
          }}
        >
          <label className="block text-xs text-gray-600"><span className="mb-1 block font-medium">Proveedor / acreedor (opcional)</span><input id="gestoria-proveedor" role="combobox" value={data.supplierOrCreditor} onChange={(event) => { update("supplierOrCreditor", event.target.value); setSupplierSearch(event.target.value); setSupplierMenuOpen(true) }} onFocus={() => { if (data.supplierOrCreditor) { setSupplierSearch(data.supplierOrCreditor); setSupplierMenuOpen(true) } }} aria-autocomplete="list" aria-controls="gestoria-proveedores-lista" aria-expanded={supplierMenuOpen} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" /></label>
          <label className="block text-xs text-gray-600"><span className="mb-1 block font-medium">NIF</span><input id="gestoria-nif" role="combobox" value={data.taxId} onChange={(event) => { const value = event.target.value.toUpperCase(); update("taxId", value); setSupplierSearch(value); setSupplierMenuOpen(true) }} onFocus={() => { if (data.taxId) { setSupplierSearch(data.taxId); setSupplierMenuOpen(true) } }} aria-autocomplete="list" aria-controls="gestoria-proveedores-lista" aria-expanded={supplierMenuOpen} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" /></label>
          {supplierMenuOpen && supplierSearch.trim() && (
            <div id="gestoria-proveedores-lista" role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg sm:col-span-2">
              {supplierLoading ? <p className="px-3 py-2 text-xs text-gray-500">Buscando proveedores...</p> : supplierOptions.length === 0 ? <p className="px-3 py-2 text-xs text-gray-500">No se encontraron proveedores.</p> : supplierOptions.map((supplier) => <button key={supplier.id} type="button" role="option" aria-selected={false} onMouseDown={(event) => event.preventDefault()} onClick={() => selectSupplier(supplier)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50"><span className="min-w-0 truncate font-medium text-gray-900">{supplier.legalName}</span><span className="shrink-0 font-mono text-xs text-gray-500">{supplier.taxId}</span></button>)}
            </div>
          )}
        </div>
        <Input label="Concepto" value={data.concept} onChange={(value) => update("concept", value)} />
        <Input label="Forma pago" value={data.paymentMethod} onChange={(value) => update("paymentMethod", value)} />
      </div>
    </section>

    <section>
      <h3 className="mb-2 text-sm font-semibold text-gray-900">Impuestos</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Base exenta / 0%" type="number" value={data.exemptBase} onChange={(value) => update("exemptBase", value)} />
        {TAX_FIELDS.map((tax) => <div key={tax.rate} className="grid grid-cols-2 gap-2 rounded-md border border-gray-200 p-2"><Input label={`Base ${tax.rate}%`} type="number" value={data[tax.base]} onChange={(value) => updateTaxBase(tax, value)} /><Input label={`IVA ${tax.rate}%`} type="number" value={data[tax.vat]} onChange={(value) => update(tax.vat, value)} readOnly={data.source === "MANUAL"} /></div>)}
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
