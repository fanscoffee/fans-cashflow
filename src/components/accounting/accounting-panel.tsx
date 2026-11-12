"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import AccountingInvoiceForm from "./accounting-invoice-form"
import AccountingCaptureLinkPanel from "./accounting-capture-link-panel"
import AccountingReconciliationPanel from "./accounting-reconciliation-panel"
import AccountingInvoiceActions from "./accounting-invoice-actions"
import { withCalculatedAccountingTotals, type AccountingInvoiceFormData } from "@/lib/accounting-invoices"
import { AccountingReconciliationStatus, PaymentDocumentType, UserRole, type DatabaseAccountingReconciliationStatus, type DatabasePaymentDocumentType } from "@/lib/database-enums"
import { MONTH_NAMES } from "@/lib/constants"
import { hasAnyRole } from "@/lib/roles"

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
  documentType?: DatabasePaymentDocumentType | null
  reconciliationStatus?: DatabaseAccountingReconciliationStatus | null
  inventoryInvoice?: { id: string } | null
  alerts: unknown
  createdAt: string
  createdBy?: { name: string | null; email: string } | null
}

function number(value: unknown) { return Number(value || 0).toFixed(2) }
function dateInput(value: string) { return value ? new Date(value).toISOString().slice(0, 10) : "" }
function timestamp(value: string) {
  return new Date(value).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })
}
function dateValue(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
function toFormValues(invoice: AccountingInvoice): AccountingInvoiceFormData {
  return withCalculatedAccountingTotals({
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
    documentType: invoice.documentType || PaymentDocumentType.EXPENSE,
  })
}

function documentTypeLabel(value: DatabasePaymentDocumentType | null | undefined) {
  if (value === PaymentDocumentType.MERCHANDISE_PURCHASE) return "Compra de mercancía"
  if (value === PaymentDocumentType.EXPENSE) return "Gasto / servicio"
  return "Pendiente de clasificar"
}

function reconciliationStatusLabel(value: DatabaseAccountingReconciliationStatus | null | undefined) {
  const labels: Record<string, string> = {
    [AccountingReconciliationStatus.UNLINKED]: "Sin vincular",
    [AccountingReconciliationStatus.SUGGESTED]: "Sugerida",
    [AccountingReconciliationStatus.LINKED]: "Vinculada",
    [AccountingReconciliationStatus.ISSUE]: "Con incidencia",
    [AccountingReconciliationStatus.NOT_APPLICABLE]: "No aplica",
  }
  return labels[value || AccountingReconciliationStatus.UNLINKED] || "Sin vincular"
}

function reconciliationStatusClass(value: DatabaseAccountingReconciliationStatus | null | undefined) {
  if (value === AccountingReconciliationStatus.LINKED) return "bg-green-100 text-green-800"
  if (value === AccountingReconciliationStatus.ISSUE) return "bg-amber-100 text-amber-800"
  return "bg-gray-100 text-gray-700"
}

const currentDate = new Date()
const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
const currentMonthStartValue = dateValue(currentMonthStart)
const currentDateValue = dateValue(currentDate)
const currentYearValue = String(currentDate.getFullYear())

export default function AccountingPanel() {
  const { data: session } = useSession()
  const [view, setView] = useState<"list" | "form" | "reconciliation" | "capture-link">("list")
  const [editing, setEditing] = useState<AccountingInvoiceFormData | undefined>()
  const [editingId, setEditingId] = useState<string | undefined>()
  const [reconciliationId, setReconciliationId] = useState<string | undefined>()
  const [captureLinkInvoiceId, setCaptureLinkInvoiceId] = useState<string | undefined>()
  const [invoices, setInvoices] = useState<AccountingInvoice[]>([])
  const [search, setSearch] = useState("")
  const [filterMonth, setFilterMonth] = useState("")
  const [filterYearEnabled, setFilterYearEnabled] = useState(false)
  const [filterYear, setFilterYear] = useState(currentYearValue)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [exporting, setExporting] = useState(false)
  const [exportFrom, setExportFrom] = useState(currentMonthStartValue)
  const [exportTo, setExportTo] = useState(currentDateValue)
  const pageSize = 20

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const captureId = new URLSearchParams(window.location.search).get("capturaId")
    if (captureId) {
      setReconciliationId(captureId)
      setView("reconciliation")
      return
    }
    const invoiceId = new URLSearchParams(window.location.search).get("facturaId")
    if (invoiceId) {
      setCaptureLinkInvoiceId(invoiceId)
      setView("capture-link")
    }
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (search.trim()) params.set("search", search.trim())
      if (filterMonth) params.set("month", filterMonth)
      if (filterYearEnabled && filterYear) params.set("year", filterYear)
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
  }, [filterMonth, filterYear, filterYearEnabled, page, search])

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

  function openReconciliation(id: string) {
    setError("")
    setSuccess("")
    setReconciliationId(id)
    setView("reconciliation")
  }

  function clearDateFilters() {
    setFilterMonth("")
    setFilterYearEnabled(false)
    setFilterYear(currentYearValue)
    setPage(1)
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
    if (!exportFrom || !exportTo || exportFrom > exportTo) {
      setError("Selecciona un rango de fechas válido")
      return
    }

    setExporting(true)
    setError("")
    try {
      const params = new URLSearchParams({ from: exportFrom, to: exportTo })
      const response = await fetch(`/api/gestoria/export?${params.toString()}`)
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || "No se pudo generar el Excel")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `fans-cashflow-gestoria-capturadas-${exportFrom}-${exportTo}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo generar el Excel")
    } finally {
      setExporting(false)
    }
  }

  if (view === "reconciliation" && reconciliationId) {
    return <AccountingReconciliationPanel
      captureId={reconciliationId}
       canUnlink={hasAnyRole(session?.user?.role, [UserRole.ADMIN, UserRole.PARTNER])}
      onBack={() => { setView("list"); setReconciliationId(undefined) }}
      onComplete={(message) => { setSuccess(message); setView("list"); setReconciliationId(undefined); void loadInvoices() }}
    />
  }

  if (view === "capture-link" && captureLinkInvoiceId) {
    return <AccountingCaptureLinkPanel
      invoiceId={captureLinkInvoiceId}
      onBack={() => { setView("list"); setCaptureLinkInvoiceId(undefined) }}
      onComplete={(message) => { setSuccess(message); setView("list"); setCaptureLinkInvoiceId(undefined); void loadInvoices() }}
    />
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
          <label className="text-xs text-gray-600"><span className="mb-1 block font-medium">Subida desde</span><input type="date" value={exportFrom} max={exportTo || undefined} onChange={(event) => setExportFrom(event.target.value)} className="rounded-md border px-3 py-2 text-sm text-gray-900" /></label>
          <label className="text-xs text-gray-600"><span className="mb-1 block font-medium">Subida hasta</span><input type="date" value={exportTo} min={exportFrom || undefined} onChange={(event) => setExportTo(event.target.value)} className="rounded-md border px-3 py-2 text-sm text-gray-900" /></label>
          <button type="button" onClick={() => void exportInvoices()} disabled={exporting || !exportFrom || !exportTo || exportFrom > exportTo} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-60">{exporting ? "Generando..." : "Exportar Excel"}</button>
        </div>
        <p className="mt-2 text-xs text-gray-500">La exportación de gestoría incluye capturas sin vínculo; las vinculadas aparecen una sola vez en la exportación operativa.</p>
     </div>
     <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 shadow-sm">
       <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
         <label className="text-xs font-medium text-gray-700"><span className="mb-1 block">Filtrar por mes</span><select value={filterMonth} onChange={(event) => { setFilterMonth(event.target.value); setPage(1) }} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 sm:w-48"><option value="">Todos los meses</option>{MONTH_NAMES.map((monthName, index) => <option key={monthName} value={index + 1}>{monthName}</option>)}</select></label>
         <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={filterYearEnabled} onChange={(event) => { setFilterYearEnabled(event.target.checked); setPage(1) }} />Filtrar también por año</label>
         <label className="text-xs font-medium text-gray-700"><span className="mb-1 block">Año</span><input type="number" min="1900" max="2200" value={filterYear} disabled={!filterYearEnabled} onChange={(event) => { setFilterYear(event.target.value); setPage(1) }} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 sm:w-32" /></label>
         <button type="button" onClick={clearDateFilters} disabled={!filterMonth && !filterYearEnabled} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">Limpiar filtro</button>
       </div>
       <p className="mt-2 text-xs text-gray-500">Selecciona solo un mes para ver ese mes en todos los años. Activa el año para limitar la búsqueda a un año concreto.</p>
     </div>
     <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Buscar factura, proveedor, NIF..." className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm text-gray-900" /><span className="text-sm text-gray-500">{total} registro(s)</span></div>
     {loading ? (
       <p className="text-sm text-gray-500">Cargando...</p>
     ) : invoices.length === 0 ? (
       <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">No hay facturas capturadas.</div>
     ) : (
       <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
         <table className="w-full min-w-[1050px] text-left text-sm text-black">
           <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
             <tr>
               <th scope="col" className="whitespace-nowrap px-4 py-3">Fecha</th>
               <th scope="col" className="whitespace-nowrap px-4 py-3">Subida</th>
               <th scope="col" className="whitespace-nowrap px-4 py-3">Factura Nº</th>
               <th scope="col" className="px-4 py-3">Proveedor / acreedor</th>
               <th scope="col" className="whitespace-nowrap px-4 py-3">NIF</th>
               <th scope="col" className="whitespace-nowrap px-4 py-3">Tipo</th>
               <th scope="col" className="whitespace-nowrap px-4 py-3">Vinculación</th>
               <th scope="col" className="whitespace-nowrap px-4 py-3 text-right">Total</th>
               <th scope="col" className="whitespace-nowrap px-4 py-3 text-right">Acciones</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-200">
             {invoices.map((invoice) => {
                const linked = Boolean(invoice.inventoryInvoice)
               return (
                 <tr key={invoice.id} className="transition-colors even:bg-gray-50/40 hover:bg-blue-50/40">
                   <td className="whitespace-nowrap px-4 py-4 align-middle font-medium text-gray-900">{new Date(invoice.date).toLocaleDateString("es-ES")}</td>
                   <td className="whitespace-nowrap px-4 py-4 align-middle text-xs text-gray-500">{timestamp(invoice.createdAt)}</td>
                   <td className="whitespace-nowrap px-4 py-4 align-middle font-semibold text-gray-900">{invoice.invoiceNumber || "Sin número"}</td>
                   <td className="px-4 py-4 align-middle font-medium text-gray-900"><div className="max-w-[230px] break-words">{invoice.supplierOrCreditor || "—"}</div></td>
                   <td className="whitespace-nowrap px-4 py-4 align-middle font-mono text-xs text-gray-700">{invoice.taxId || "-"}</td>
                   <td className="px-4 py-4 align-middle text-xs"><span className="inline-flex whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">{documentTypeLabel(invoice.documentType)}</span></td>
                   <td className="min-w-[180px] px-4 py-4 align-middle text-xs"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 font-medium ${reconciliationStatusClass(invoice.reconciliationStatus)}`}>{reconciliationStatusLabel(invoice.reconciliationStatus)}</span></td>
                   <td className="whitespace-nowrap px-4 py-4 text-right align-middle text-base font-semibold tabular-nums text-gray-900">{number(invoice.invoiceTotal)} €</td>
                   <td className="px-4 py-4 text-right align-middle"><AccountingInvoiceActions linked={linked} reviewLabel={invoice.documentType === PaymentDocumentType.EXPENSE ? "Revisar" : invoice.documentType === PaymentDocumentType.MERCHANDISE_PURCHASE ? "Vincular albaranes" : "Revisar / vincular"} onReview={() => openReconciliation(invoice.id)} onEdit={() => startEdit(invoice)} onDelete={() => void deleteInvoice(invoice.id)} /></td>
                 </tr>
               )
             })}
           </tbody>
         </table>
       </div>
     )}
    {totalPages > 1 && <div className="flex items-center justify-between text-sm text-gray-600"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border px-3 py-2 disabled:opacity-40">Anterior</button><span>Página {page} de {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-md border px-3 py-2 disabled:opacity-40">Siguiente</button></div>}
  </section>
}
