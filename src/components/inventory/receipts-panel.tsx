"use client"

import { useState, useEffect, useCallback } from "react"
import ReceiptForm from "./receipt-form"

interface Supplier {
  id: string
  legalName: string
}

interface ReceiptLine {
  id: string
  receivedQuantity: number
  unitPrice: number
  batch: string | null
  dueDate: string | null
  product: {
    id: string
    code: string
    posDescription: string
    purchaseUnit: string
    itemType: string
  }
}

interface Receipt {
  id: string
  deliveryNoteCode: string
  receivedAt: string
  notes: string | null
  supplier: { legalName: string }
  receivedBy: { name: string } | null
  _count: { lines: number }
  lines?: ReceiptLine[]
}

type ReceiptsPanelProps = {
  canDelete?: boolean
  initialView?: "list" | "create"
}

export default function ReceiptsPanel({ canDelete = true, initialView = "list" }: ReceiptsPanelProps) {
  const [view, setView] = useState<"list" | "create" | "detail">(initialView)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState("")
  const [supplierFilter, setSupplierFilter] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const pageSize = 20

  useEffect(() => {
    fetch("/api/inventario/proveedores?pageSize=200")
      .then((r) => r.json())
      .then((d) => setSuppliers(d.suppliers || []))
      .catch(() => {})
  }, [])

  const loadReceipts = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (supplierFilter) params.set("supplierId", supplierFilter)
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))

      const r = await fetch(`/api/inventario/recepciones?${params}`)
      if (!r.ok) throw new Error("Error al cargar recepciones")
      const d = await r.json()
      setReceipts(d.receipts || [])
      setTotal(d.total || 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [search, supplierFilter, startDate, endDate, page])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadReceipts()
  }, [loadReceipts])

  useEffect(() => {
    setPage(1)
  }, [search, supplierFilter, startDate, endDate])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleCreate = async (data: {
    supplierId: string
    deliveryNoteCode: string
    receivedAt: string
    notes?: string
    lines: Array<{
      productId: string
      receivedQuantity: number
      unitPrice: number
      batch?: string
      dueDate?: string
    }>
  }) => {
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      const r = await fetch("/api/inventario/recepciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!r.ok) {
        const d = await r.json()
        throw new Error(d.error || "Error al crear recepción")
      }
      setSuccess("Recepción registrada correctamente")
      setView("list")
      loadReceipts()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!canDelete) return
    if (!confirm("¿Eliminar esta recepción?")) return
    setError("")
    setSuccess("")
    try {
      const r = await fetch(`/api/inventario/recepciones/${id}`, { method: "DELETE" })
      if (!r.ok) throw new Error("Error al eliminar recepción")
      setSuccess("Recepción eliminada")
      loadReceipts()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    }
  }

  const handleViewDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const r = await fetch(`/api/inventario/recepciones/${id}`)
      if (!r.ok) throw new Error("Error al cargar detalle")
      const d = await r.json()
      setSelectedReceipt(d)
      setView("detail")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setDetailLoading(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  if (view === "create") {
    return (
      <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Nueva recepción</h2>
          <button
            onClick={() => setView("list")}
            className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
          >
            Volver
          </button>
        </div>
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}
        <ReceiptForm onSubmit={handleCreate} onCancel={() => setView("list")} saving={saving} />
      </div>
    )
  }

  if (view === "detail" && selectedReceipt) {
    const totalLines = (selectedReceipt.lines || []).reduce(
      (sum, l) => sum + Number(l.receivedQuantity) * Number(l.unitPrice),
      0
    )
    return (
      <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Albarán: {selectedReceipt.deliveryNoteCode}
          </h2>
          <button
            onClick={() => { setView("list"); setSelectedReceipt(null) }}
            className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
          >
            Volver
          </button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 text-sm min-[420px]:grid-cols-2 sm:grid-cols-4">
          <div>
            <span className="text-gray-500">Proveedor</span>
            <p className="font-medium text-gray-900">{selectedReceipt.supplier.legalName}</p>
          </div>
          <div>
            <span className="text-gray-500">Fecha</span>
            <p className="font-medium text-gray-900">
              {new Date(selectedReceipt.receivedAt).toLocaleDateString("es-ES")}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Registrado por</span>
            <p className="font-medium text-gray-900">{selectedReceipt.receivedBy?.name || "—"}</p>
          </div>
          {selectedReceipt.notes && (
            <div>
              <span className="text-gray-500">Notas</span>
              <p className="font-medium text-gray-900">{selectedReceipt.notes}</p>
            </div>
          )}
        </div>

        {detailLoading ? (
          <p className="text-sm text-gray-500">Cargando líneas...</p>
        ) : (
          <div className="overflow-x-auto rounded-md border bg-white">
            <table className="w-full min-w-max text-left text-sm sm:min-w-0">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500">
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2 text-right">Cantidad</th>
                  <th className="px-3 py-2">UoM</th>
                  <th className="px-3 py-2 text-right">Precio Unit.</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                  <th className="px-3 py-2">Lote</th>
                  <th className="px-3 py-2">Vencimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(selectedReceipt.lines || []).map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-900">{l.product.code}</td>
                    <td className="px-3 py-2 text-gray-900">{l.product.posDescription}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{l.product.itemType}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{Number(l.receivedQuantity)}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{l.product.purchaseUnit}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{Number(l.unitPrice).toFixed(4)}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      {(Number(l.receivedQuantity) * Number(l.unitPrice)).toFixed(2)} €
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{l.batch || "—"}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {l.dueDate
                        ? new Date(l.dueDate).toLocaleDateString("es-ES")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-gray-50">
                  <td colSpan={6} className="px-3 py-2 text-right text-sm font-semibold text-gray-900">
                    Total:
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">
                    {totalLines.toFixed(2)} €
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-600">{success}</div>
      )}

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          onClick={() => setView("create")}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
        >
          + Nueva recepción
        </button>
        <span className="text-center text-sm text-gray-500 sm:ml-auto">
          {total} recepcione{total !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por albarán..."
          className="w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:min-w-[180px] sm:flex-1"
        />
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 sm:w-auto"
        >
          <option value="">Todos los proveedores</option>
          {suppliers.map((p) => (
            <option key={p.id} value={p.id}>{p.legalName}</option>
          ))}
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 sm:w-auto"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 sm:w-auto"
        />
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando recepciones...</p>
      ) : receipts.length === 0 ? (
        <p className="text-sm text-gray-500">No se encontraron recepciones.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border bg-white [scrollbar-width:thin]">
            <table className="w-full min-w-max text-left text-sm sm:min-w-0">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500">
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Albarán</th>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2 text-center">Líneas</th>
                  <th className="px-3 py-2">Registrado por</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {receipts.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900">
                      {new Date(rec.receivedAt).toLocaleDateString("es-ES")}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs font-medium text-gray-900">
                      {rec.deliveryNoteCode}
                    </td>
                    <td className="px-3 py-2 text-gray-900">{rec.supplier.legalName}</td>
                    <td className="px-3 py-2 text-center text-gray-600">{rec._count.lines}</td>
                    <td className="px-3 py-2 text-gray-600">{rec.receivedBy?.name || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleViewDetail(rec.id)}
                        className="mr-2 text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        Ver
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(rec.id)}
                          className="text-xs font-medium text-red-600 hover:text-red-800"
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-600">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
