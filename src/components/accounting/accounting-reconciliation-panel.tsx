"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AccountingReconciliationStatus, PaymentDocumentType, PaymentEntity, type DatabasePaymentEntity } from "@/lib/database-enums"
import { normalizeTaxId } from "@/lib/invoices"

type SupplierCandidate = {
  id: string
  legalName: string
  taxId: string
  billingAddress: string | null
  score: number
  reasons: string[]
}

type DeliveryNote = {
  id: string
  deliveryNoteCode: string
  receivedAt: string
  lineCount: number
  productIds: string[]
  baseTotal: number
  transportCost: number
  totalWithTransport: number
  score: number
  reasons: string[]
  lines: Array<{
    productId: string
    receivedQuantity: number
    unitPrice: number
    product: { code: string; posDescription: string; purchaseUnit: string | null }
  }>
}

type ReconciliationData = {
  capture: {
    id: string
    invoiceNumber: string
    taxId: string
    supplierOrCreditor: string
    invoiceTotal: number | string
    totalBase: number | string
    totalVat: number | string
    documentType?: string | null
    entity?: DatabasePaymentEntity | null
  }
  status: string
  supplier: { id: string; legalName: string; taxId: string; billingAddress: string | null } | null
  supplierCandidates: SupplierCandidate[]
  linkedInvoice: {
    id: string
    series: string
    number: string
    workflowStatus: string
    totalAmount: number | string
    deliveryNotes: Array<{ id: string; deliveryNoteCode: string; receivedAt: string }>
  } | null
  deliveryNotes: DeliveryNote[]
  suggestedReceiptIds: string[]
  totals: {
    invoiceBase: number
    invoiceVat: number
    invoiceTotal: number
    availableReceiptBase: number
    availableReceiptTotalWithTransport: number
  }
  alerts: string[]
}

function money(value: unknown) {
  return Number(value || 0).toFixed(2)
}

function date(value: string) {
  return new Date(value).toLocaleDateString("es-ES")
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    [AccountingReconciliationStatus.UNLINKED]: "Sin vincular",
    [AccountingReconciliationStatus.SUGGESTED]: "Sugerencias disponibles",
    [AccountingReconciliationStatus.LINKED]: "Vinculada",
    [AccountingReconciliationStatus.ISSUE]: "Vinculada con incidencia",
    [AccountingReconciliationStatus.NOT_APPLICABLE]: "No aplica",
  }
  return labels[value] || value
}

function workflowLabel(value: string) {
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
  return labels[value] || value
}

export default function AccountingReconciliationPanel({ captureId, canUnlink, onBack, onComplete }: { captureId: string; canUnlink: boolean; onBack: () => void; onComplete: (message: string) => void }) {
  const [data, setData] = useState<ReconciliationData | null>(null)
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>([])
  const [supplierId, setSupplierId] = useState("")
  const [entity, setEntity] = useState<DatabasePaymentEntity>(PaymentEntity.BAKERY)
  const [includeTransport, setIncludeTransport] = useState(true)
  const [providerExceptionReason, setProviderExceptionReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const loadSuggestions = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/gestoria/facturas/${captureId}/sugerencias`)
      const result = await response.json() as ReconciliationData & { error?: string }
      if (!response.ok) throw new Error(result.error || "No se pudieron cargar las sugerencias")
      setData(result)
      setSupplierId(result.supplier?.id || result.supplierCandidates[0]?.id || "")
      setEntity(result.capture.entity || PaymentEntity.BAKERY)
      setSelectedReceiptIds(result.linkedInvoice ? [] : result.suggestedReceiptIds || [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar las sugerencias")
    } finally {
      setLoading(false)
    }
  }, [captureId])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { void loadSuggestions() }, [loadSuggestions])
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedReceipts = useMemo(() => data?.deliveryNotes.filter((receipt) => selectedReceiptIds.includes(receipt.id)) || [], [data, selectedReceiptIds])
  const selectedBase = selectedReceipts.reduce((total, receipt) => total + receipt.baseTotal, 0)
  const selectedTransport = selectedReceipts.reduce((total, receipt) => total + receipt.transportCost, 0)
  const selectedSupplier = data?.supplierCandidates.find((candidate) => candidate.id === supplierId) || data?.supplier || null
  const captureTaxId = normalizeTaxId(data?.capture.taxId || "")
  const providerMismatch = Boolean(selectedSupplier && (!captureTaxId || normalizeTaxId(selectedSupplier.taxId) !== captureTaxId))
  const isExpense = data?.capture.documentType === PaymentDocumentType.EXPENSE
  const isLinked = Boolean(data?.linkedInvoice)

  function toggleReceipt(id: string) {
    setSelectedReceiptIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }

  async function link() {
    if (!data || selectedReceiptIds.length === 0 || !supplierId) return
    if (providerMismatch && !providerExceptionReason.trim()) {
      setError("Indica el motivo de la excepción de proveedor antes de continuar")
      return
    }
    if (!window.confirm("¿Confirmar la vinculación? Se creará una factura operativa en borrador o con incidencia; no se conformará automáticamente.")) return

    setSaving(true)
    setError("")
    try {
      const response = await fetch(`/api/gestoria/facturas/${captureId}/vincular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptIds: selectedReceiptIds, supplierId, entity, includeTransport, providerExceptionReason: providerExceptionReason.trim() || undefined }),
      })
      const result = await response.json() as { error?: string; alerts?: string[] }
      if (!response.ok) throw new Error(result.error || "No se pudo vincular la factura")
      onComplete(result.alerts?.length ? `Factura vinculada con ${result.alerts.length} incidencia(s)` : "Factura vinculada correctamente")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo vincular la factura")
    } finally {
      setSaving(false)
    }
  }

  async function unlink() {
    if (!canUnlink || !data?.linkedInvoice) return
    const reason = window.prompt("Motivo de la desvinculación")?.trim()
    if (!reason) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch(`/api/gestoria/facturas/${captureId}/vinculo`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || "No se pudo desvincular la factura")
      onComplete("Vínculo eliminado; la factura operativa se conserva")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo desvincular la factura")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <section className="rounded-lg border bg-white p-6 shadow-sm"><p className="text-sm text-gray-500">Cargando sugerencias...</p></section>
  if (!data) return <section className="rounded-lg border bg-white p-6 shadow-sm"><p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error || "No se pudo cargar la conciliación"}</p><button type="button" onClick={onBack} className="rounded-md border px-3 py-2 text-sm text-gray-700">Volver</button></section>

  return <section className="space-y-4 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs font-medium uppercase tracking-wide text-gray-500">Conciliación de gestoría</p><h2 className="text-lg font-semibold text-gray-900">Factura {data.capture.invoiceNumber || "sin número"}</h2><p className="text-sm text-gray-600">{data.capture.supplierOrCreditor || "Proveedor no identificado"} · NIF {data.capture.taxId || "no informado"}</p></div>
      <button type="button" onClick={onBack} className="rounded-md border px-3 py-2 text-sm text-gray-700">Volver</button>
    </div>
    <div className="flex flex-wrap items-center gap-2 text-xs"><span className={`rounded-full px-2 py-1 font-medium ${data.status === AccountingReconciliationStatus.ISSUE ? "bg-amber-100 text-amber-800" : data.status === AccountingReconciliationStatus.LINKED ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}>{statusLabel(data.status)}</span><span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">{isExpense ? "Gasto / servicio" : data.capture.documentType ? "Compra de mercancía" : "Tipo pendiente de clasificar"}</span></div>
    {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {data.alerts.length > 0 && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><strong>Alertas de la captura</strong>{data.alerts.map((alert) => <p key={alert}>{alert}</p>)}</div>}

    {isLinked && data.linkedInvoice ? <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900"><p className="font-semibold">Factura operativa vinculada</p><p className="mt-1">{data.linkedInvoice.series ? `${data.linkedInvoice.series}/` : ""}{data.linkedInvoice.number} · {money(data.linkedInvoice.totalAmount)} € · estado {workflowLabel(data.linkedInvoice.workflowStatus)}</p><p className="mt-1">Albaranes: {data.linkedInvoice.deliveryNotes.map((receipt) => receipt.deliveryNoteCode).join(", ") || "ninguno"}</p>{canUnlink && <button type="button" onClick={() => void unlink()} disabled={saving} className="mt-3 rounded-md border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-50">Desvincular conservando factura</button>}</div> : isExpense ? <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">Esta captura está clasificada como gasto/servicio. Se mantiene en gestoría y no muestra opciones de albarán.</div> : <>
      <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><p className="font-semibold">Selecciona y confirma manualmente</p><p className="mt-1">Las sugerencias solo ayudan a revisar; no crean vínculos hasta pulsar el botón de confirmación.</p></div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-md border p-4"><h3 className="mb-2 text-sm font-semibold text-gray-900">Proveedor del catálogo</h3><select aria-label="Proveedor para vincular" value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"><option value="">Selecciona proveedor</option>{data.supplierCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.legalName} · {candidate.taxId} · {candidate.score} puntos</option>)}</select>{selectedSupplier && <p className="mt-2 text-xs text-gray-600">{selectedSupplier.legalName} · {selectedSupplier.taxId}</p>}{providerMismatch && <><p className="mt-2 text-xs text-amber-800">El NIF no coincide o falta en la captura. La excepción debe quedar justificada.</p><textarea aria-label="Motivo de excepción de proveedor" value={providerExceptionReason} onChange={(event) => setProviderExceptionReason(event.target.value)} placeholder="Motivo de la confirmación manual" className="mt-2 min-h-20 w-full rounded-md border px-3 py-2 text-sm text-gray-900" /></>}</div>
         <div className="rounded-md border p-4 text-black"><h3 className="mb-2 text-sm font-semibold text-black">Resumen de importes</h3><div className="grid grid-cols-2 gap-2 text-sm"><span>Factura base</span><strong className="text-right">{money(data.totals.invoiceBase)} €</strong><span>Albaranes seleccionados</span><strong className="text-right">{money(selectedBase)} €</strong><span>Transporte</span><strong className="text-right">{money(selectedTransport)} €</strong><span>Total factura</span><strong className="text-right">{money(data.totals.invoiceTotal)} €</strong></div><label className="mt-3 flex items-center gap-2 text-xs text-black"><input type="checkbox" checked={includeTransport} onChange={(event) => setIncludeTransport(event.target.checked)} />Incorporar transporte como línea de cargo</label><label className="mt-3 block text-xs text-black">Entidad<select aria-label="Entidad de la factura vinculada" value={entity} onChange={(event) => setEntity(event.target.value as DatabasePaymentEntity)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm text-black"><option value={PaymentEntity.BAKERY}>Obrador</option><option value={PaymentEntity.COFFEE_SHOP}>Cafetería</option></select></label></div>
      </div>
       <div className="space-y-2 text-black"><h3 className="text-sm font-semibold text-black">Albaranes libres sugeridos</h3>{data.deliveryNotes.length === 0 ? <p className="rounded-md border p-4 text-sm text-black">No hay albaranes libres para este proveedor.</p> : data.deliveryNotes.map((receipt) => <label key={receipt.id} className={`flex cursor-pointer flex-col gap-2 rounded-md border p-3 text-sm text-black sm:flex-row sm:items-center sm:justify-between ${selectedReceiptIds.includes(receipt.id) ? "border-blue-400 bg-blue-50" : "hover:bg-gray-50"}`}><span className="flex items-start gap-2"><input type="checkbox" checked={selectedReceiptIds.includes(receipt.id)} onChange={() => toggleReceipt(receipt.id)} className="mt-1" /><span><strong>{receipt.deliveryNoteCode}</strong> · {date(receipt.receivedAt)} · {receipt.lineCount} línea(s)<span className="mt-1 block text-xs text-black">{receipt.reasons.length ? `${receipt.score} puntos: ${receipt.reasons.join(", ")}` : "Sin coincidencia automática fuerte"}</span></span></span><span className="text-right text-xs text-black">Base {money(receipt.baseTotal)} €<br />Total {money(receipt.totalWithTransport)} €</span></label>)}</div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4"><span className="mr-auto text-sm text-gray-600">{selectedReceiptIds.length} albarán(es) seleccionado(s)</span><button type="button" onClick={() => void loadSuggestions()} disabled={saving} className="rounded-md border px-3 py-2 text-sm text-gray-700 disabled:opacity-50">Actualizar sugerencias</button><button type="button" onClick={() => void link()} disabled={saving || selectedReceiptIds.length === 0 || !supplierId || (providerMismatch && !providerExceptionReason.trim())} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Vinculando..." : "Confirmar vinculación"}</button></div>
    </>}
  </section>
}
