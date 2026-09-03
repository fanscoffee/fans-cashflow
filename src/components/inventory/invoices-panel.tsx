"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { PaymentDocumentType, PaymentEntity, UserRole, parsePaymentDocumentType, parsePaymentEntity, type DatabasePaymentDocumentType, type DatabasePaymentEntity } from "@/lib/database-enums"
import { hasAnyRole, isRole } from "@/lib/roles"
import InvoiceForm, { type InvoiceFormData } from "./invoice-form"

interface InvoiceListItem {
  id: string
  series: string
  number: string
  issueDate: string
  status: string
  paymentStatus: string
  workflowStatus?: string
  entity?: DatabasePaymentEntity
  confirmedAmount?: number | string | null
  withheldAmount?: number | string | null
  totalAmount: number | string
  alerts: unknown
  supplier: { id: string; legalName: string; taxId: string }
  confirmedBy: { name: string | null } | null
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
  lines: Array<{ id: string; productId: string | null; lineType: string; supplierReference: string | null; itemCode: string | null; description: string; unitOfMeasure: string | null; originalFormat: string | null; quantity: number | string; discountPercentage: number | string | null; discountAmount: number | string; unitPrice: number | string; netUnitPrice: number | string; taxableBase: number | string; vatRate: number | string | null; vatAmount: number | string; lineTotal: number | string; batch: string | null; dueDate: string | null; validationAlert: string | null; product: { id: string; code: string; posDescription: string; purchaseUnit: string | null } | null }>
  taxes: Array<{ type: "IVA" | "RECARGO_EQUIVALENCIA" | "IRPF"; percentage: number | string | null; taxableBase: number | string; taxAmount: number | string }>
  attachments: Array<{ id: string; fileName: string; mimeType: string }>
}

function number(value: unknown) { return Number(value || 0).toFixed(2) }
function dateInput(value: string | null | undefined) { return value ? new Date(value).toISOString().slice(0, 10) : "" }

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
  useEffect(() => { loadInvoices() }, [loadInvoices])
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

  async function deleteInvoice(id: string) {
    if (!canDelete) return
    if (!confirm("¿Eliminar esta factura? Se borrarán sus líneas y adjuntos, y no se podrá deshacer.")) return
    setError("")
    setSuccess("")
    const response = await fetch(`/api/inventario/facturas/${id}`, { method: "DELETE" })
    if (!response.ok) { const result = await response.json(); setError(result.error || "No se pudo eliminar la factura"); return }
    setSelected(null)
    setView("list")
    setSuccess("Factura eliminada")
    await loadInvoices()
  }

  if (view === "create" || (view === "edit" && selected)) return <div className="rounded-lg border bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">{view === "edit" ? "Editar factura" : "Nueva factura"}</h2><button type="button" onClick={() => setView("list")} className="rounded-md border px-3 py-2 text-sm text-gray-700">Volver</button></div>{error && <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}<InvoiceForm invoiceId={view === "edit" ? selected?.id : undefined} initialValues={view === "edit" && selected ? toFormValues(selected) : undefined} onCancel={() => setView("list")} onSubmit={(data) => saveInvoice(data, view === "edit" ? selected?.id : undefined)} saving={saving} /></div>

  if (view === "detail" && selected) return <div className="rounded-lg border bg-white p-6 text-black shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-gray-900">Factura {selected.series ? `${selected.series}/` : ""}{selected.number}</h2><p className="text-sm text-black">{selected.supplier.legalName} · {new Date(selected.issueDate).toLocaleDateString("es-ES")}</p></div><button type="button" onClick={() => { setSelected(null); setView("list") }} className="rounded-md border px-3 py-2 text-sm text-black">Volver</button></div><div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5"><div><span className="text-black">Neto</span><p>{number(selected.netTotal)} €</p></div><div><span className="text-black">IVA</span><p>{number(selected.totalVat)} €</p></div><div><span className="text-black">Recargo</span><p>{number(selected.surchargeTotal)} €</p></div><div><span className="text-black">Retenciones</span><p>{number(selected.withholdingTotal)} €</p></div><div><span className="text-black">Total</span><p className="font-semibold">{number(selected.totalAmount)} €</p></div></div><div className="mt-4 rounded-md border p-3 text-sm"><p><strong>Emisor:</strong> {selected.issuerLegalName} · {selected.issuerTaxId}</p><p><strong>Pago:</strong> {selected.paymentStatus} {selected.paymentMethod ? `· ${selected.paymentMethod}` : ""}</p><p><strong>Albaranes:</strong> {selected.deliveryNotes.length ? selected.deliveryNotes.map((deliveryNote) => deliveryNote.deliveryNoteCode).join(", ") : "Sin vínculo"}</p></div>{Array.isArray(selected.alerts) && selected.alerts.length > 0 && <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><strong>Alertas</strong>{selected.alerts.map((alert, index) => <p key={index}>{String(alert)}</p>)}</div>}<div className="mt-4 overflow-x-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs text-black"><tr><th className="px-3 py-2">Producto</th><th className="px-3 py-2">Cantidad</th><th className="px-3 py-2">Precio neto</th><th className="px-3 py-2">IVA</th><th className="px-3 py-2 text-right">Total</th></tr></thead><tbody className="divide-y">{selected.lines.map((line) => <tr key={line.id}><td className="px-3 py-2">{line.product?.code || "Cargo"} — {line.description}{line.validationAlert && <p className="text-xs text-amber-700">{line.validationAlert}</p>}</td><td className="px-3 py-2">{String(line.quantity)} {line.unitOfMeasure || ""}</td><td className="px-3 py-2">{number(line.netUnitPrice)} €</td><td className="px-3 py-2">{String(line.vatRate || 0)}%</td><td className="px-3 py-2 text-right">{number(line.lineTotal)} €</td></tr>)}</tbody></table></div>{canDelete && <div className="mt-4 flex gap-2">{isAdmin && <button type="button" onClick={() => setView("edit")} className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white">Editar</button>}<button type="button" onClick={() => deleteInvoice(selected.id)} className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700">Eliminar</button></div>}</div>

  const totalPages = Math.ceil(total / pageSize)
  return <div className="space-y-4">{error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</p>}<div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => { setError(""); setView("create") }} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">+ Nueva factura</button><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar número, serie, NIF..." className="min-w-56 rounded-md border px-3 py-2 text-sm text-gray-900" /><span className="ml-auto text-sm text-gray-500">{total} factura(s)</span></div>{loading ? <p className="text-sm text-gray-500">Cargando...</p> : invoices.length === 0 ? <p className="text-sm text-gray-500">No hay facturas.</p> : <div className="overflow-x-auto rounded-md border bg-white"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs text-gray-500"><tr><th className="px-3 py-2">Factura</th><th className="px-3 py-2">Proveedor</th><th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Albaranes</th><th className="px-3 py-2">Pago</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Acciones</th></tr></thead><tbody className="divide-y">{invoices.map((invoice) => <tr key={invoice.id}><td className="px-3 py-2 font-medium">{invoice.series ? `${invoice.series}/` : ""}{invoice.number}{invoice.status === "ANULADA" && <span className="ml-2 text-xs text-red-600">ANULADA</span>}{Array.isArray(invoice.alerts) && invoice.alerts.length > 0 && <span className="ml-2 text-xs text-amber-600">⚠ {invoice.alerts.length}</span>}</td><td className="px-3 py-2">{invoice.supplier.legalName}</td><td className="px-3 py-2">{new Date(invoice.issueDate).toLocaleDateString("es-ES")}</td><td className="px-3 py-2">{invoice._count.deliveryNotes}</td><td className="px-3 py-2">{invoice.paymentStatus}</td><td className="px-3 py-2 text-right">{number(invoice.totalAmount)} €</td><td className="px-3 py-2 text-right"><button type="button" onClick={() => showDetail(invoice.id)} className="mr-2 text-xs text-blue-700">Ver</button>{canDelete && <button type="button" onClick={() => deleteInvoice(invoice.id)} className="text-xs text-red-700">Eliminar</button>}</td></tr>)}</tbody></table></div>}{totalPages > 1 && <div className="flex justify-center gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50">Anterior</button><span className="px-2 py-1 text-sm">Página {page}/{totalPages}</span><button type="button" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50">Siguiente</button></div>}
  </div>
}
