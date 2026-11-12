"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { InvoiceWorkflowStatus, PaymentDocumentType, PaymentEntity, UserRole, parseInvoiceWorkflowStatus, parsePaymentDocumentType, parsePaymentEntity, type DatabaseInvoiceWorkflowStatus, type DatabasePaymentDocumentType, type DatabasePaymentEntity } from "@/lib/database-enums"
import { hasAnyRole, isRole } from "@/lib/roles"
import InvoiceForm, { type InvoiceFormData } from "./invoice-form"
import InvoiceActions from "./invoice-actions"

interface InvoiceListItem {
  id: string
  series: string
  number: string
  issueDate: string
  status: string
  paymentStatus: string
  workflowStatus?: DatabaseInvoiceWorkflowStatus
  entity?: DatabasePaymentEntity
  confirmedAmount?: number | string | null
  withheldAmount?: number | string | null
  totalAmount: number | string
  alerts: unknown
  supplier: { id: string; legalName: string; taxId: string }
  confirmedBy: { name: string | null } | null
  accountingInvoice?: { id: string; invoiceNumber: string; reconciliationStatus: string } | null
  _count: { lines: number; deliveryNotes: number }
}

interface InvoiceDetail extends InvoiceListItem {
  documentType?: DatabasePaymentDocumentType
  operationDate: string | null
  dueDate: string | null
  paymentDate: string | null
  orderNumber: string | null
  orderDate: string | null
  deliveryCenter: string | null
  deliveryNoteReference: string | null
  deliveryNoteDate: string | null
  paymentMethod: string | null
  paidAmount: number | string | null
  issuerLegalName: string
  issuerTaxId: string
  issuerBillingAddress: string
  netTotal: number | string
  discountTotal: number | string
  totalVat: number | string
  surchargeTotal: number | string
  withholdingTotal: number | string
  notes: string | null
  deliveryNotes: Array<{ id: string; deliveryNoteCode: string; receivedAt: string }>
  lines: Array<{
    id: string
    productId: string | null
    lineType: string
    supplierReference: string | null
    itemCode: string | null
    description: string
    unitOfMeasure: string | null
    originalFormat: string | null
    quantity: number | string
    discountPercentage: number | string | null
    discountAmount: number | string
    unitPrice: number | string
    netUnitPrice: number | string
    taxableBase: number | string
    vatRate: number | string | null
    vatAmount: number | string
    lineTotal: number | string
    batch: string | null
    dueDate: string | null
    validationAlert: string | null
    product: { id: string; code: string; posDescription: string; purchaseUnit: string | null } | null
  }>
  taxes: Array<{ type: "IVA" | "RECARGO_EQUIVALENCIA" | "IRPF"; percentage: number | string | null; taxableBase: number | string; taxAmount: number | string }>
  attachments: Array<{ id: string; fileName: string; mimeType: string }>
  accountingInvoice?: { id: string; invoiceNumber: string; taxId: string; reconciliationStatus: string; linkedAt: string | null; linkedBy: { id: string; name: string | null; email: string } | null } | null
}

function number(value: unknown) { return Number(value || 0).toFixed(2) }
function dateInput(value: string | null | undefined) { return value ? new Date(value).toISOString().slice(0, 10) : "" }

function workflowLabel(value: string | undefined) {
  const parsed = parseInvoiceWorkflowStatus(value)
  const labels: Record<string, string> = {
    DRAFT: "Borrador",
    IN_REVIEW: "En cotejo",
    ISSUE: "Incidencia",
    CONFIRMED: "Conformada",
    PARTIALLY_CONFIRMED: "Parcialmente conformada",
    VOID: "Anulada",
    BORRADOR: "Borrador",
    EN_COTEJO: "En cotejo",
    INCIDENCIA: "Incidencia",
    CONFORMADA: "Conformada",
    PARCIALMENTE_CONFORMADA: "Parcialmente conformada",
    ANULADA: "Anulada",
  }
  return labels[parsed || value || ""] || value || "Sin estado"
}

function workflowClass(value: string | undefined) {
  const parsed = parseInvoiceWorkflowStatus(value)
  if (parsed === InvoiceWorkflowStatus.CONFIRMED) return "bg-green-100 text-green-800"
  if (parsed === InvoiceWorkflowStatus.PARTIALLY_CONFIRMED) return "bg-blue-100 text-blue-800"
  if (parsed === InvoiceWorkflowStatus.ISSUE) return "bg-amber-100 text-amber-800"
  if (parsed === InvoiceWorkflowStatus.VOID) return "bg-red-100 text-red-800"
  return "bg-gray-100 text-gray-700"
}

function reconciliationLabel(value: string | undefined) {
  const labels: Record<string, string> = {
    LINKED: "Vinculada",
    ISSUE: "Vinculada con incidencia",
    UNLINKED: "Sin vincular",
    SUGGESTED: "Sugerencia disponible",
    NOT_APPLICABLE: "No aplica",
    VINCULADA: "Vinculada",
    CON_INCIDENCIA: "Vinculada con incidencia",
    SIN_VINCULAR: "Sin vincular",
    SUGERIDA: "Sugerencia disponible",
    NO_APLICA: "No aplica",
  }
  return labels[value || ""] || value || "Sin captura"
}

function reconciliationClass(value: string | undefined) {
  if (value === "LINKED" || value === "VINCULADA") return "bg-green-100 text-green-800"
  if (value === "ISSUE" || value === "CON_INCIDENCIA") return "bg-amber-100 text-amber-800"
  if (value === "SUGGESTED" || value === "SUGERIDA") return "bg-blue-100 text-blue-800"
  return "bg-gray-100 text-gray-700"
}

function paymentStatusLabel(value: string) {
  if (value === "PAGADA") return "Pagada"
  if (value === "PARCIAL") return "Parcial"
  if (value === "PENDIENTE") return "Pendiente"
  return value
}

function paymentStatusClass(value: string) {
  if (value === "PAGADA") return "bg-green-100 text-green-800"
  if (value === "PARCIAL") return "bg-blue-100 text-blue-800"
  return "bg-gray-100 text-gray-700"
}

function toFormValues(invoice: InvoiceDetail): InvoiceFormData {
  return {
    supplierId: invoice.supplier.id,
    entity: parsePaymentEntity(invoice.entity) || PaymentEntity.BAKERY,
    documentType: parsePaymentDocumentType(invoice.documentType) || PaymentDocumentType.MERCHANDISE_PURCHASE,
    invoiceFile: null,
    confirmConAttachment: true,
    existingAttachment: invoice.attachments.length > 0,
    confirmedAmount: invoice.confirmedAmount == null ? "" : number(invoice.confirmedAmount),
    withheldAmount: invoice.withheldAmount == null ? "0" : number(invoice.withheldAmount),
    withholdingReason: "",
    sourceReference: "",
    series: invoice.series,
    number: invoice.number,
    issueDate: dateInput(invoice.issueDate),
    operationDate: dateInput(invoice.operationDate),
    dueDate: dateInput(invoice.dueDate),
    paymentDate: dateInput(invoice.paymentDate),
    orderNumber: invoice.orderNumber || "",
    orderDate: dateInput(invoice.orderDate),
    deliveryCenter: invoice.deliveryCenter || "",
    deliveryNoteReference: invoice.deliveryNoteReference || "",
    deliveryNoteDate: dateInput(invoice.deliveryNoteDate),
    paymentMethod: invoice.paymentMethod || "",
    paymentStatus: "PENDIENTE",
    issuerLegalName: invoice.issuerLegalName,
    issuerTaxId: invoice.issuerTaxId,
    issuerBillingAddress: invoice.issuerBillingAddress,
    netTotal: number(invoice.netTotal),
    discountTotal: number(invoice.discountTotal),
    totalVat: number(invoice.totalVat),
    surchargeTotal: number(invoice.surchargeTotal),
    withholdingTotal: number(invoice.withholdingTotal),
    totalAmount: number(invoice.totalAmount),
    paidAmount: invoice.paidAmount == null ? "" : number(invoice.paidAmount),
    notes: invoice.notes || "",
    validRecipientTaxId: true,
    recipientTaxId: "B09711078",
    receiptIds: invoice.deliveryNotes.map((deliveryNote) => deliveryNote.id),
    lines: invoice.lines.map((line) => ({
      productId: line.productId || "",
      lineType: line.lineType === "CARGO" ? "CARGO" : "PRODUCTO",
      supplierReference: line.supplierReference || "",
      itemCode: line.itemCode || "",
      description: line.description,
      unitOfMeasure: line.unitOfMeasure || "",
      originalFormat: line.originalFormat || "",
      quantity: String(line.quantity),
      discountPercentage: String(line.discountPercentage || 0),
      discountAmount: String(line.discountAmount),
      unitPrice: String(line.unitPrice),
      netUnitPrice: String(line.netUnitPrice),
      taxableBase: String(line.taxableBase),
      vatRate: String(line.vatRate || 0),
      vatAmount: String(line.vatAmount),
      lineTotal: String(line.lineTotal),
      batch: line.batch || "",
      dueDate: dateInput(line.dueDate),
    })),
    taxes: invoice.taxes.map((tax) => ({ type: tax.type, percentage: String(tax.percentage || 0), taxableBase: String(tax.taxableBase), taxAmount: String(tax.taxAmount) })),
  }
}

export default function InvoicesPanel() {
  const { data: session } = useSession()
  const isAdmin = isRole(session?.user?.role, UserRole.ADMIN)
  const canDelete = hasAnyRole(session?.user?.role, [UserRole.ADMIN, UserRole.PARTNER])
  const canResolveIncident = hasAnyRole(session?.user?.role, [UserRole.ADMIN, UserRole.PARTNER])
  const [view, setView] = useState<"list" | "create" | "detail" | "edit">("list")
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [selected, setSelected] = useState<InvoiceDetail | null>(null)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const pageSize = 20

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (search) params.set("search", search)
      const response = await fetch(`/api/inventario/facturas?${params}`)
      if (!response.ok) throw new Error("Error al cargar facturas")
      const data = await response.json()
      setInvoices(data.invoices || [])
      setTotal(data.total || 0)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error desconocido")
    } finally { setLoading(false) }
  }, [page, search])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { void loadInvoices() }, [loadInvoices])
  useEffect(() => { setPage(1) }, [search])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function saveInvoice(data: InvoiceFormData, id?: string) {
    setSaving(true); setError(""); setSuccess("")
    try {
      const response = await fetch(id ? `/api/inventario/facturas/${id}` : "/api/inventario/facturas", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Error al guardar factura")
      if (data.invoiceFile && result.invoice?.id) {
        const form = new FormData()
        form.set("file", data.invoiceFile)
        form.set("invoiceId", result.invoice.id)
        const attachmentResponse = await fetch("/api/pagos/adjuntos", { method: "POST", body: form })
        const attachmentResult = await attachmentResponse.json()
        if (!attachmentResponse.ok) throw new Error(attachmentResult.error || "La factura se guardó, pero no se pudo guardar el adjunto")
      }
      if (data.confirmConAttachment && result.invoice?.id) {
        const conformResponse = await fetch(`/api/inventario/facturas/${result.invoice.id}/conformar`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity: data.entity, confirmedAmount: Number(data.confirmedAmount || data.totalAmount), withheldAmount: Number(data.withheldAmount || 0), withholdingReason: data.withholdingReason, sourceReference: data.sourceReference }) })
        const conformResult = await conformResponse.json()
        if (!conformResponse.ok) throw new Error(conformResult.error || "La factura se guardó, pero no pudo conformarse")
      }
      setSuccess(result.alerts?.length ? `Factura guardada con ${result.alerts.length} alerta(s)` : "Factura guardada")
      setView("list")
      await loadInvoices()
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error desconocido")
      return false
    } finally { setSaving(false) }
  }

  async function showDetail(id: string, target: "detail" | "edit" = "detail") {
    setError("")
    const response = await fetch(`/api/inventario/facturas/${id}`)
    if (!response.ok) { setError("No se pudo cargar la factura"); return }
    setSelected(await response.json())
    setView(target)
  }

  async function resolveIncident(id: string) {
    if (!canResolveIncident) return
    const reason = window.prompt("Motivo de la resolución", "Diferencia de céntimos revisada y aceptada")?.trim()
    if (!reason) return
    if (!window.confirm("La incidencia se marcará como revisada sin modificar importes ni pagos. ¿Continuar?")) return

    setSaving(true)
    setError("")
    setSuccess("")
    try {
      const response = await fetch(`/api/inventario/facturas/${id}/resolver-incidencia`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || "No se pudo resolver la incidencia")
      setSelected(null)
      setView("list")
      setSuccess("Incidencia resuelta")
      await loadInvoices()
    } catch (reasonError) {
      setError(reasonError instanceof Error ? reasonError.message : "No se pudo resolver la incidencia")
    } finally {
      setSaving(false)
    }
  }

  async function deleteInvoice(id: string) {
    if (!canDelete) return
    const target = invoices.find((invoice) => invoice.id === id)
    if (target?.accountingInvoice) { setError("Una factura operativa vinculada no se puede eliminar"); return }
    if (!confirm("¿Eliminar esta factura? Se borrarán sus líneas y adjuntos, y no se podrá deshacer.")) return
    setError(""); setSuccess("")
    const response = await fetch(`/api/inventario/facturas/${id}`, { method: "DELETE" })
    if (!response.ok) { const result = await response.json(); setError(result.error || "No se pudo eliminar la factura"); return }
    setSelected(null)
    setView("list")
    setSuccess("Factura eliminada")
    await loadInvoices()
  }

  if (view === "create" || (view === "edit" && selected)) {
    return <div className="rounded-lg border bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">{view === "edit" ? "Editar factura" : "Nueva factura"}</h2><button type="button" onClick={() => setView("list")} className="rounded-md border px-3 py-2 text-sm text-gray-700">Volver</button></div>{error && <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}<InvoiceForm invoiceId={view === "edit" ? selected?.id : undefined} initialValues={view === "edit" && selected ? toFormValues(selected) : undefined} onCancel={() => setView("list")} onSubmit={(data) => saveInvoice(data, view === "edit" ? selected?.id : undefined)} saving={saving} /></div>
  }

  if (view === "detail" && selected) {
    const linkedCapture = selected.accountingInvoice
    const hasIncident = parseInvoiceWorkflowStatus(selected.workflowStatus) === InvoiceWorkflowStatus.ISSUE
    return <div className="rounded-lg border bg-white p-6 text-black shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-gray-900">Factura {selected.series ? `${selected.series}/` : ""}{selected.number}</h2><p className="text-sm text-black">{selected.supplier.legalName} · {new Date(selected.issueDate).toLocaleDateString("es-ES")}</p></div><button type="button" onClick={() => { setSelected(null); setView("list") }} className="rounded-md border px-3 py-2 text-sm text-black">Volver</button></div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-gray-100 px-2 py-1">Estado: {workflowLabel(selected.workflowStatus)}</span><span className="rounded-full bg-gray-100 px-2 py-1">Pago: {selected.paymentStatus}</span><span className="rounded-full bg-gray-100 px-2 py-1">Tipo: {selected.documentType === PaymentDocumentType.EXPENSE ? "Gasto / servicio" : "Compra de mercancía"}</span></div>
      {linkedCapture ? <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900"><p className="font-semibold">Captura de gestoría vinculada</p><p className="mt-1">{linkedCapture.invoiceNumber || "Sin número"} · {reconciliationLabel(linkedCapture.reconciliationStatus)}</p><a href={`/gestoria?capturaId=${linkedCapture.id}`} className="mt-1 inline-block font-medium underline">Volver a la captura</a></div> : <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700"><p>Esta factura operativa no tiene captura de gestoría vinculada.</p><a href={`/gestoria?facturaId=${selected.id}`} className="mt-1 inline-block font-medium text-blue-700 underline">Vincular una captura existente</a></div>}
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5"><div><span className="text-black">Neto</span><p>{number(selected.netTotal)} €</p></div><div><span className="text-black">IVA</span><p>{number(selected.totalVat)} €</p></div><div><span className="text-black">Recargo</span><p>{number(selected.surchargeTotal)} €</p></div><div><span className="text-black">Retenciones</span><p>{number(selected.withholdingTotal)} €</p></div><div><span className="text-black">Total</span><p className="font-semibold">{number(selected.totalAmount)} €</p></div></div>
      <div className="mt-4 rounded-md border p-3 text-sm"><p><strong>Emisor:</strong> {selected.issuerLegalName} · {selected.issuerTaxId}</p><p><strong>Pago:</strong> {selected.paymentStatus} {selected.paymentMethod ? `· ${selected.paymentMethod}` : ""}</p><p><strong>Albaranes:</strong> {selected.deliveryNotes.length ? selected.deliveryNotes.map((deliveryNote) => deliveryNote.deliveryNoteCode).join(", ") : "Sin vínculo"}</p></div>
      {(hasIncident || (Array.isArray(selected.alerts) && selected.alerts.length > 0)) && <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{hasIncident ? "Incidencia" : "Alertas"}</strong>{hasIncident && canResolveIncident && <button type="button" onClick={() => void resolveIncident(selected.id)} disabled={saving} className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">Resolver incidencia</button>}</div>{Array.isArray(selected.alerts) && selected.alerts.length > 0 ? selected.alerts.map((alert, index) => <p key={index} className="mt-1">{String(alert)}</p>) : <p className="mt-1">La factura está marcada con incidencia, pero no tiene alertas detalladas.</p>}{hasIncident && <p className="mt-2 text-xs text-amber-900/80">La resolución quedará registrada y no modificará los importes ni los pagos.</p>}</div>}
      <div className="mt-4 overflow-x-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs text-black"><tr><th className="px-3 py-2">Descripción</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2 text-right">Cantidad</th><th className="px-3 py-2 text-right">Base</th><th className="px-3 py-2 text-right">IVA</th><th className="px-3 py-2 text-right">Total</th></tr></thead><tbody className="divide-y">{selected.lines.map((line) => <tr key={line.id}><td className="px-3 py-2">{line.description}</td><td className="px-3 py-2 text-xs">{line.lineType}</td><td className="px-3 py-2 text-right">{line.quantity}</td><td className="px-3 py-2 text-right">{number(line.taxableBase)} €</td><td className="px-3 py-2 text-right">{number(line.vatAmount)} €</td><td className="px-3 py-2 text-right font-medium">{number(line.lineTotal)} €</td></tr>)}</tbody></table></div>
      <div className="mt-4 flex justify-end gap-2">{!linkedCapture && <button type="button" onClick={() => void showDetail(selected.id, "edit")} className="rounded-md border px-3 py-2 text-sm text-gray-700">Editar</button>}{!linkedCapture && canDelete && <button type="button" onClick={() => void deleteInvoice(selected.id)} className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700">Eliminar</button>}</div>
    </div>
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return <div className="space-y-4">
    {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {success && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</p>}
    <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => { setError(""); setView("create") }} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">+ Nueva factura</button><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar número, serie, NIF..." className="min-w-56 rounded-md border px-3 py-2 text-sm text-gray-900" /><span className="ml-auto text-sm text-gray-500">{total} factura(s)</span></div>
    {loading ? (
      <p className="text-sm text-gray-500">Cargando...</p>
    ) : invoices.length === 0 ? (
      <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">No hay facturas.</p>
    ) : (
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[1050px] text-left text-sm text-black">
          <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            <tr>
              <th scope="col" className="whitespace-nowrap px-4 py-3">Factura</th>
              <th scope="col" className="px-4 py-3">Proveedor</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3">Fecha</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3">Estado</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3">Gestoría</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3">Albaranes</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3">Pago</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-right">Total</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {invoices.map((invoice) => {
              const hasIncident = parseInvoiceWorkflowStatus(invoice.workflowStatus) === InvoiceWorkflowStatus.ISSUE
              const invoiceAlerts = Array.isArray(invoice.alerts) ? invoice.alerts.length : 0
              return (
                <tr key={invoice.id} className="transition-colors even:bg-gray-50/40 hover:bg-blue-50/40">
                  <td className="px-4 py-4 align-middle"><div className="flex flex-wrap items-center gap-1.5"><span className="font-semibold text-gray-900">{invoice.series ? `${invoice.series}/` : ""}{invoice.number}</span>{invoice.status === "ANULADA" && <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">Anulada</span>}{invoiceAlerts > 0 && <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700" title={`${invoiceAlerts} alerta(s)`}>⚠ {invoiceAlerts}</span>}</div></td>
                  <td className="px-4 py-4 align-middle font-medium text-gray-900"><div className="max-w-[240px] break-words">{invoice.supplier.legalName}</div></td>
                  <td className="whitespace-nowrap px-4 py-4 align-middle text-gray-700">{new Date(invoice.issueDate).toLocaleDateString("es-ES")}</td>
                  <td className="px-4 py-4 align-middle text-xs"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 font-medium ${workflowClass(invoice.workflowStatus)}`}>{workflowLabel(invoice.workflowStatus)}</span></td>
                  <td className="px-4 py-4 align-middle text-xs">{invoice.accountingInvoice ? <a href={`/gestoria?capturaId=${invoice.accountingInvoice.id}`} className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 font-medium underline decoration-transparent underline-offset-2 hover:decoration-current ${reconciliationClass(invoice.accountingInvoice.reconciliationStatus)}`}>{reconciliationLabel(invoice.accountingInvoice.reconciliationStatus)}</a> : <a href={`/gestoria?facturaId=${invoice.id}`} className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900">Vincular captura</a>}</td>
                  <td className="px-4 py-4 align-middle"><span className="inline-flex min-w-8 justify-center rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700">{invoice._count.deliveryNotes}</span></td>
                  <td className="px-4 py-4 align-middle text-xs"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 font-medium ${paymentStatusClass(invoice.paymentStatus)}`}>{paymentStatusLabel(invoice.paymentStatus)}</span></td>
                  <td className="whitespace-nowrap px-4 py-4 text-right align-middle text-base font-semibold tabular-nums text-gray-900">{number(invoice.totalAmount)} €</td>
                  <td className="px-4 py-4 text-right align-middle"><InvoiceActions canEdit={!invoice.accountingInvoice && isAdmin} canDelete={!invoice.accountingInvoice && canDelete} canResolve={hasIncident && canResolveIncident} onView={() => void showDetail(invoice.id)} onEdit={() => void showDetail(invoice.id, "edit")} onDelete={() => void deleteInvoice(invoice.id)} onResolve={() => void resolveIncident(invoice.id)} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )}
    {totalPages > 1 && <div className="flex items-center justify-between text-sm text-gray-600"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border px-3 py-2 disabled:opacity-40">Anterior</button><span>Página {page} de {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-md border px-3 py-2 disabled:opacity-40">Siguiente</button></div>}
  </div>
}
