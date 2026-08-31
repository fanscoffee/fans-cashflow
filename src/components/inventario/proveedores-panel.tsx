"use client"

import { useState, useEffect, useCallback } from "react"
import ProveedorForm from "@/components/inventario/proveedor-form"

interface Proveedor {
  id: string
  razonSocial: string
  cifNif: string
  direccionFiscal: string | null
  contactoNombre: string | null
  contactoTelefono: string | null
  contactoEmail: string | null
  iban: string | null
  categoriaServicio: string | null
  condicionesPago: string | null
  plazoEntregaDias: number | null
  pedidoMinimo: number | null
  notasCondiciones: string | null
  frecuenciaEntrega: string | null
  horarioEntrega: string | null
  metodoPedido: string | null
  estado: string
  fechaAlta: string
  valoracionFiabilidad: number | null
  valoracionCalidad: number | null
  valoracionPrecio: number | null
  incidencias: string | null
  observaciones: string | null
  _count?: { productos: number }
}

type ViewMode = "list" | "create" | "edit"

export default function ProveedoresPanel({ canDelete = false }: { canDelete?: boolean }) {
  const [view, setView] = useState<ViewMode>("list")
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editing, setEditing] = useState<Proveedor | null>(null)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 50

  const loadProveedores = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (filtroEstado) params.set("estado", filtroEstado)
      if (filtroCategoria) params.set("categoria", filtroCategoria)
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))

      const res = await fetch(`/api/inventario/proveedores?${params}`)
      if (res.ok) {
        const data = await res.json()
        setProveedores(data.proveedores)
        setTotal(data.total)
      }
    } catch {
      setError("Error al cargar los proveedores")
    } finally {
      setLoading(false)
    }
  }, [search, filtroEstado, filtroCategoria, page])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadProveedores()
  }, [loadProveedores])

  useEffect(() => {
    setPage(1)
  }, [search, filtroEstado, filtroCategoria])
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
      loadProveedores()
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
      loadProveedores()
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
      loadProveedores()
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
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 sm:w-auto">
              <option value="">Todos los estados</option>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </select>
            <input
              type="text"
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              placeholder="Filtrar por categoría..."
              className="w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:min-w-[150px] sm:w-auto"
            />
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Cargando proveedores...</p>
          ) : proveedores.length === 0 ? (
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
                    {proveedores.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{p.razonSocial}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">{p.cifNif}</td>
                        <td className="px-3 py-2 text-gray-600">{p.categoriaServicio || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{p.contactoNombre || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{p._count?.productos ?? 0}</td>
                        <td className="px-3 py-2 text-yellow-600 text-xs">
                          {renderRating(p.valoracionFiabilidad)}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.estado === "Activo" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                          }`}>
                            {p.estado}
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
          <ProveedorForm onSubmit={handleCreate} onCancel={() => setView("list")} saving={saving} />
        </div>
      )}

      {view === "edit" && editing && (
        <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Editar: {editing.razonSocial}
          </h2>
          <ProveedorForm
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
