"use client"

import { useCallback, useEffect, useState } from "react"
import AccountingInvoiceForm from "./accounting-invoice-form"
import type { AccountingInvoiceFormData } from "@/lib/accounting-invoices"

interface AccountingInvoice {
  id: string
  date: string
  invoiceNumber: string
  supplierOrCreditor: string
  taxId: string
  concept: string
  exemptBase: number | string
  base21: number | string
  vat21: number | string
  base10: number | string
  vat10: number | string
  base4: number | string
  vat4: number | string
  base2: number | string
  vat2: number | string
  totalBase: number | string
  totalVat: number | string
  withholdingTax: number | string
  invoiceTotal: number | string
  paymentMethod: string
  ocrText?: string | null
  source: "OCR" | "MANUAL"
  alerts: unknown
  createdBy?: { name: string | null; email: string } | null
}

function number(value: unknown) { return Number(value || 0).toFixed(2) }
function dateInput(value: string) { return value ? new Date(value).toISOString().slice(0, 10) : "" }
function alerts(value: unknown) { return Array.isArray(value) ? value.map(String) : [] }

function toFormValues(invoice: AccountingInvoice): AccountingInvoiceFormData {
  return {
    date: dateInput(invoice.date),
    invoiceNumber: invoice.invoiceNumber,
    supplierOrCreditor: invoice.supplierOrCreditor,
    taxId: invoice.taxId,
    concept: invoice.concept,
    exemptBase: number(invoice.exemptBase),
    base21: number(invoice.base21),
    vat21: number(invoice.vat21),
    base10: number(invoice.base10),
    vat10: number(invoice.vat10),
    base4: number(invoice.base4),
    vat4: number(invoice.vat4),
    base2: number(invoice.base2),
    vat2: number(invoice.vat2),
    totalBase: number(invoice.totalBase),
    totalVat: number(invoice.totalVat),
    withholdingTax: number(invoice.withholdingTax),
    invoiceTotal: number(invoice.invoiceTotal),
    paymentMethod: invoice.paymentMethod,
    ocrText: invoice.ocrText || "",
    source: invoice.source,
  }
}

const currentDate = new Date()
const currentMonth = currentDate.getMonth() + 1
const currentYear = currentDate.getFullYear()

export default function AccountingPanel() {
  const [view, setView] = useState<"list" | "form">("list")
  const [editing, setEditing] = useState<AccountingInvoiceFormData | undefined>()
  const [editingId, setEditingId] = useState<string | undefined>()
  const [invoices, setInvoices] = useState<AccountingInvoice[]>([])
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [exporting, setExporting] = useState(false)
  const [exportMonth, setExportMonth] = useState(String(currentMonth))
  const [exportYear, setExportYear] = useState(String(currentYear))
  const pageSize = 20

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (search.trim()) params.set("search", search.trim())
      const response = await fetch(`/api/gestoria/facturas?${params}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudieron cargar las facturas")
      setInvoices(result.invoices || [])
      setTotal(result.total || 0)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar las facturas")
    } finally {
      setLoading(false)
    }
  }, [page, search])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { void loadInvoices() }, [loadInvoices])
  /* eslint-enable react-hooks/set-state-in-effect */

  function startCreate() {
    setEditing(undefined)
    setEditingId(undefined)
    setError("")
    setSuccess("")
    setView("form")
  }

  function startEdit(invoice: AccountingInvoice) {
    setEditing(toFormValues(invoice))
    setEditingId(invoice.id)
    setError("")
    setSuccess("")
    setView("form")
  }

  async function saveInvoice(data: AccountingInvoiceFormData) {
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      const id = editingId
      const response = await fetch(id ? `/api/gestoria/facturas/${id}` : "/api/gestoria/facturas", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo guardar la factura")
      setSuccess(result.alerts?.length ? `Factura guardada con ${result.alerts.length} alerta(s)` : "Factura guardada")
      setView("list")
      setEditing(undefined)
      setEditingId(undefined)
      await loadInvoices()
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la factura")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function deleteInvoice(id: string) {
    if (!confirm("¿Eliminar esta factura de gestoría? No se podrá deshacer.")) return
    setError("")
    setSuccess("")
    const response = await fetch(`/api/gestoria/facturas/${id}`, { method: "DELETE" })
    const result = await response.json()
    if (!response.ok) { setError(result.error || "No se pudo eliminar la factura"); return }
    setSuccess("Factura eliminada")
    await loadInvoices()
  }

  async function exportInvoices() {
    setExporting(true)
    setError("")
    try {
      const response = await fetch(`/api/gestoria/export?month=${exportMonth}&year=${exportYear}`)
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || "No se pudo generar el Excel")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `fans-cashflow-gestoria-capturadas-${exportYear}-${exportMonth.padStart(2, "0")}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo generar el Excel")
    } finally {
      setExporting(false)
    }
  }

  if (view === "form") return <section className="rounded-lg border bg-white p-4 shadow-sm sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-gray-900">{editing ? "Editar factura de gestoría" : "Nueva factura de gestoría"}</h2><p className="text-xs text-gray-500">Sin proveedor ni producto del catálogo.</p></div><button type="button" onClick={() => { setView("list"); setEditing(undefined); setEditingId(undefined) }} className="rounded-md border px-3 py-2 text-sm text-gray-700">Volver</button></div>{error && <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}<AccountingInvoiceForm initialValues={editing} onCancel={() => { setView("list"); setEditing(undefined); setEditingId(undefined) }} onSubmit={saveInvoice} saving={saving} /></section>

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return <section className="space-y-4">
    {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {success && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</p>}
    <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="text-lg font-semibold text-gray-900">Facturas capturadas</h2><p className="text-xs text-gray-500">Registros independientes para la gestoría.</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={startCreate} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Leer factura</button><button type="button" onClick={startCreate} className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Entrada manual</button></div>
      </div>
      <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-end">
        <label className="text-xs text-gray-600"><span className="mb-1 block font-medium">Mes</span><select value={exportMonth} onChange={(event) => setExportMonth(event.target.value)} className="rounded-md border px-3 py-2 text-sm text-gray-900">{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2000, index, 1).toLocaleDateString("es-ES", { month: "long" })}</option>)}</select></label>
        <label className="text-xs text-gray-600"><span className="mb-1 block font-medium">Año</span><input type="number" min="2000" max="2100" value={exportYear} onChange={(event) => setExportYear(event.target.value)} className="w-28 rounded-md border px-3 py-2 text-sm text-gray-900" /></label>
        <button type="button" onClick={() => void exportInvoices()} disabled={exporting} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-60">{exporting ? "Generando..." : "Exportar Excel"}</button>
      </div>
    </div>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Buscar factura, proveedor, NIF..." className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm text-gray-900" /><span className="text-sm text-gray-500">{total} registro(s)</span></div>
    {loading ? <p className="text-sm text-gray-500">Cargando...</p> : invoices.length === 0 ? <div className="rounded-lg border bg-white p-8 text-center text-sm text-gray-500">No hay facturas capturadas.</div> : <div className="overflow-x-auto rounded-lg border bg-white shadow-sm"><table className="w-full min-w-[760px] text-left text-sm text-black"><thead className="bg-gray-50 text-xs text-black"><tr><th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Factura Nº</th><th className="px-3 py-2">Proveedor / acreedor</th><th className="px-3 py-2">NIF</th><th className="px-3 py-2">Origen</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Acciones</th></tr></thead><tbody className="divide-y">{invoices.map((invoice) => { const invoiceAlerts = alerts(invoice.alerts); return <tr key={invoice.id}><td className="whitespace-nowrap px-3 py-3">{new Date(invoice.date).toLocaleDateString("es-ES")}</td><td className="px-3 py-3 font-medium">{invoice.invoiceNumber || "Sin número"}</td><td className="px-3 py-3">{invoice.supplierOrCreditor}</td><td className="px-3 py-3">{invoice.taxId || "-"}</td><td className="px-3 py-3 text-xs">{invoice.source}{invoiceAlerts.length > 0 && <span className="ml-2 text-amber-700">⚠ {invoiceAlerts.length}</span>}</td><td className="px-3 py-3 text-right font-semibold">{number(invoice.invoiceTotal)} €</td><td className="px-3 py-3 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => startEdit(invoice)} className="rounded-md border px-2 py-1 text-xs text-gray-700">Editar</button><button type="button" onClick={() => void deleteInvoice(invoice.id)} className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700">Eliminar</button></div></td></tr> })}</tbody></table></div>}
    {totalPages > 1 && <div className="flex items-center justify-between text-sm text-gray-600"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border px-3 py-2 disabled:opacity-40">Anterior</button><span>Página {page} de {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-md border px-3 py-2 disabled:opacity-40">Siguiente</button></div>}
  </section>
}
