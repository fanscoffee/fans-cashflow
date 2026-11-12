"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { PaymentDocumentType } from "@/lib/database-enums"
import { normalizeTaxId } from "@/lib/invoices"
import { normalizeAccountingInvoiceNumber } from "@/lib/accounting-invoices"

type OperationalInvoice = {
  id: string
  series: string
  number: string
  totalAmount: number | string
  supplier: { legalName: string; taxId: string }
  accountingInvoice?: { id: string; invoiceNumber: string; reconciliationStatus: string } | null
}

type Capture = {
  id: string
  date: string
  invoiceNumber: string
  supplierOrCreditor: string
  taxId: string
  invoiceTotal: number | string
  documentType?: string | null
  reconciliationStatus?: string | null
  inventoryInvoice?: { id: string } | null
}

function money(value: unknown) {
  return Number(value || 0).toFixed(2)
}

function comparableNumber(series: string, number: string) {
  return normalizeAccountingInvoiceNumber([series, number].filter(Boolean).join("/")).replace(/[^A-Z0-9]/g, "")
}

export default function AccountingCaptureLinkPanel({ invoiceId, onBack, onComplete }: { invoiceId: string; onBack: () => void; onComplete: (message: string) => void }) {
  const [invoice, setInvoice] = useState<OperationalInvoice | null>(null)
  const [captures, setCaptures] = useState<Capture[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [invoiceResponse, capturesResponse] = await Promise.all([
        fetch(`/api/inventario/facturas/${invoiceId}`),
        fetch("/api/gestoria/facturas?page=1&pageSize=100"),
      ])
      const invoiceResult = await invoiceResponse.json() as OperationalInvoice & { error?: string }
      const capturesResult = await capturesResponse.json() as { invoices?: Capture[]; error?: string }
      if (!invoiceResponse.ok) throw new Error(invoiceResult.error || "No se pudo cargar la factura operativa")
      if (!capturesResponse.ok) throw new Error(capturesResult.error || "No se pudieron cargar las capturas")
      setInvoice(invoiceResult)
      const unlinked = (capturesResult.invoices || []).filter((capture) => !capture.inventoryInvoice && capture.documentType !== PaymentDocumentType.EXPENSE)
      setCaptures(unlinked)
      const exactNumber = comparableNumber(invoiceResult.series, invoiceResult.number)
      const exactTaxId = normalizeTaxId(invoiceResult.supplier.taxId)
      const firstMatch = unlinked.find((capture) => comparableNumber("", capture.invoiceNumber) === exactNumber && normalizeTaxId(capture.taxId) === exactTaxId)
        || unlinked.find((capture) => comparableNumber("", capture.invoiceNumber) === exactNumber)
      setSelectedId(firstMatch?.id || "")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar los datos")
    } finally {
      setLoading(false)
    }
  }, [invoiceId])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { void load() }, [load])
  /* eslint-enable react-hooks/set-state-in-effect */

  const matchingCaptures = useMemo(() => {
    if (!invoice) return captures
    const expectedNumber = comparableNumber(invoice.series, invoice.number)
    const expectedTaxId = normalizeTaxId(invoice.supplier.taxId)
    return captures.filter((capture) => {
      const numberMatches = comparableNumber("", capture.invoiceNumber) === expectedNumber
      const taxMatches = Boolean(expectedTaxId && normalizeTaxId(capture.taxId) === expectedTaxId)
      return numberMatches || taxMatches
    })
  }, [captures, invoice])

  async function link() {
    if (!selectedId) return
    if (!window.confirm("¿Vincular esta captura con la factura operativa? La factura no se conformará automáticamente.")) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch(`/api/inventario/facturas/${invoiceId}/captura`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountingInvoiceId: selectedId }) })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || "No se pudo vincular la captura")
      onComplete("Captura de gestoría vinculada")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo vincular la captura")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <section className="rounded-lg border bg-white p-6 shadow-sm"><p className="text-sm text-gray-500">Cargando capturas sin vincular...</p></section>
  if (!invoice) return <section className="rounded-lg border bg-white p-6 shadow-sm"><p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error || "No se pudo cargar la factura"}</p><button type="button" onClick={onBack} className="rounded-md border px-3 py-2 text-sm text-gray-700">Volver</button></section>

  return <section className="space-y-4 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-gray-500">Vincular captura existente</p><h2 className="text-lg font-semibold text-gray-900">Factura {invoice.series ? `${invoice.series}/` : ""}{invoice.number}</h2><p className="text-sm text-gray-600">{invoice.supplier.legalName} · {invoice.supplier.taxId} · {money(invoice.totalAmount)} €</p></div><button type="button" onClick={onBack} className="rounded-md border px-3 py-2 text-sm text-gray-700">Volver</button></div>
    {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {invoice.accountingInvoice ? <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900">Esta factura ya tiene vinculada la captura {invoice.accountingInvoice.invoiceNumber || "sin número"}.</div> : <>
      <p className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">Solo se muestran capturas de mercancía sin vínculo que coinciden por número o NIF. La confirmación es manual.</p>
      {matchingCaptures.length === 0 ? <p className="rounded-md border p-4 text-sm text-gray-500">No hay capturas compatibles sin vincular.</p> : <div className="space-y-2">{matchingCaptures.map((capture) => <label key={capture.id} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${selectedId === capture.id ? "border-blue-400 bg-blue-50" : "hover:bg-gray-50"}`}><input type="radio" name="accounting-capture" checked={selectedId === capture.id} onChange={() => setSelectedId(capture.id)} className="mt-1" /><span><strong>{capture.invoiceNumber || "Sin número"}</strong> · {capture.supplierOrCreditor || "Proveedor no identificado"}<span className="mt-1 block text-xs text-gray-500">{capture.taxId || "Sin NIF"} · {new Date(capture.date).toLocaleDateString("es-ES")} · {money(capture.invoiceTotal)} € · {capture.reconciliationStatus || "SIN_VINCULAR"}</span></span></label>)}</div>}
      <div className="flex justify-end border-t pt-4"><button type="button" onClick={() => void link()} disabled={saving || !selectedId} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Vinculando..." : "Confirmar vínculo"}</button></div>
    </>}
  </section>
}
