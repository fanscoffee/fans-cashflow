"use client"

import { useState, useEffect, useCallback } from "react"
import SupplierForm from "@/components/inventory/supplier-form"

interface Supplier {
  id: string
  legalName: string
  taxId: string
  billingAddress: string | null
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  iban: string | null
  serviceCategory: string | null
  paymentTerms: string | null
  deliveryLeadTimeDays: number | null
  minimumOrder: number | null
  termsNotes: string | null
  deliveryFrequency: string | null
  deliverySchedule: string | null
  orderingMethod: string | null
  status: string
  addedAt: string
  reliabilityRating: number | null
  qualityRating: number | null
  priceRating: number | null
  issues: string | null
  notes: string | null
  _count?: { products: number }
}

type ViewMode = "list" | "create" | "edit"

export default function SuppliersPanel({ canDelete = false }: { canDelete?: boolean }) {
  const [view, setView] = useState<ViewMode>("list")
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 50

  const loadSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (statusFilter) params.set("status", statusFilter)
      if (categoryFilter) params.set("category", categoryFilter)
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))

      const res = await fetch(`/api/inventario/proveedores?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data.suppliers)
        setTotal(data.total)
      }
    } catch {
      setError("Error al cargar los proveedores")
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, categoryFilter, page])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, categoryFilter])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleCreate(data: Record<string, unknown>) {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/inventario/proveedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al crear el proveedor")
        return false
      }
      setSuccess("Proveedor creado correctamente")
      setView("list")
      loadSuppliers()
      return true
    } catch {
      setError("Error al conectar con el servidor")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(data: Record<string, unknown>) {
    if (!editing) return false
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/inventario/proveedores/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al actualizar el proveedor")
        return false
      }
      setSuccess("Proveedor actualizado correctamente")
      setView("list")
      setEditing(null)
      loadSuppliers()
      return true
    } catch {
      setError("Error al conectar con el servidor")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!canDelete) return
    if (!confirm("¿Estás seguro de que quieres eliminar este proveedor?")) return
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/inventario/proveedores/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al eliminar el proveedor")
        return
      }
      setSuccess("Proveedor eliminado")
      loadSuppliers()
    } catch {
      setError("Error al conectar con el servidor")
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  function renderRating(value: number | null) {
    if (!value) return "—"
    return "★".repeat(value) + "☆".repeat(5 - value)
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-600">{success}</div>
      )}

      {view === "list" && (
        <>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              onClick={() => { setView("create"); setEditing(null) }}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
            >
              + Nuevo proveedor
            </button>
            <span className="text-center text-sm text-gray-500 sm:ml-auto">
              {total} proveedor{total !== 1 ? "es" : ""}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por razón social, CIF o contacto..."
              className="w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:min-w-[200px] sm:flex-1"
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 sm:w-auto">
              <option value="">Todos los estados</option>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </select>
            <input
              type="text"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              placeholder="Filtrar por categoría..."
              className="w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:min-w-[150px] sm:w-auto"
            />
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Cargando proveedores...</p>
          ) : suppliers.length === 0 ? (
            <p className="text-sm text-gray-500">No se encontraron proveedores.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border bg-white">
                <table className="w-full min-w-max text-left text-sm sm:min-w-0">
                  <thead>
                    <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500">
                      <th className="px-3 py-2">Razón social</th>
                      <th className="px-3 py-2">CIF/NIF</th>
                      <th className="px-3 py-2">Categoría</th>
                      <th className="px-3 py-2">Contacto</th>
                      <th className="px-3 py-2">Productos</th>
                      <th className="px-3 py-2">Valoración</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {suppliers.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{p.legalName}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">{p.taxId}</td>
                        <td className="px-3 py-2 text-gray-600">{p.serviceCategory || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{p.contactName || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{p._count?.products ?? 0}</td>
                        <td className="px-3 py-2 text-yellow-600 text-xs">
                          {renderRating(p.reliabilityRating)}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.status === "Activo" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => { setEditing(p); setView("edit") }}
                            className="mr-2 text-xs font-medium text-blue-600 hover:text-blue-800"
                          >
                            Editar
                          </button>
                           {canDelete && (
                             <button
                               onClick={() => handleDelete(p.id)}
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
        </>
      )}

      {view === "create" && (
        <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Nuevo proveedor</h2>
          <SupplierForm onSubmit={handleCreate} onCancel={() => setView("list")} saving={saving} />
        </div>
      )}

      {view === "edit" && editing && (
        <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Editar: {editing.legalName}
          </h2>
          <SupplierForm
            initialValues={editing}
            onSubmit={handleUpdate}
            onCancel={() => { setView("list"); setEditing(null) }}
            saving={saving}
          />
        </div>
      )}
    </div>
  )
}
