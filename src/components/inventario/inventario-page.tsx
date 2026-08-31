"use client"

import { useState, useEffect, useCallback } from "react"
import ProductoForm from "@/components/inventario/producto-form"
import CatalogoManager from "@/components/inventario/catalogo-manager"
import ProveedoresPanel from "@/components/inventario/proveedores-panel"
import ProveedorProductoPanel from "@/components/inventario/proveedor-producto-panel"
import RecepcionesPanel from "@/components/inventario/recepciones-panel"
import InventarioFisicoPanel from "@/components/inventario/inventario-fisico-panel"

interface ProveedorRelation {
  id: string
  proveedorId: string
  proveedor: { id: string; razonSocial: string }
  esPrincipal: boolean
}

interface Producto {
  id: string
  codigo: string
  codBarrasEan: string | null
  descripcionTpv: string
  descripcionCompleta: string
  tipoArticulo: string
  familia: string
  subfamilia: string | null
  seccion: string
  esComprable: boolean
  esElaborado: boolean
  esVendible: boolean
  llevaReceta: boolean
  umBaseStock: string
  umCompra: string | null
  factorCompraABase: number | null
  umVenta: string | null
  factorVentaABase: number | null
  pesoNetoUdG: number | null
  formatoPresentacion: string | null
  costeUmBase: number | null
  costeConIva: number | null
  mermaEstandarPct: number | null
  codIva: string
  ivaPct: number | null
  ivaCompraPct: number | null
  ivaVentaPct: number | null
  metodoPrecio: string
  margenObjetivoPct: number | null
  pvpObjetivoConIva: number | null
  pvpFijoConIva: number | null
  pvpAplicadoConIva: number | null
  pvpAplicadoSinIva: number | null
  gananciaEurUd: number | null
  margenRealPct: number | null
  desviacionPp: number | null
  diferenciaEurUd: number | null
  diagnosticoPrecio: string | null
  controlaStock: string
  metodoValoracion: string
  stockMinimo: number | null
  stockMaximo: number | null
  puntoPedido: number | null
  ubicacion: string | null
  claseAbc: string | null
  controlLote: string
  vidaUtilDias: number | null
  conservacion: string | null
  alergenos: string | null
  estado: string
  fechaAlta: string
  observaciones: string | null
  proveedores?: ProveedorRelation[]
}

type ViewMode = "list" | "create" | "edit" | "catalogos" | "proveedores" | "producto-proveedores" | "recepciones" | "inventario-fisico"

const TIPO_COLORS: Record<string, string> = {
  MP: "bg-blue-100 text-blue-800",
  IN: "bg-gray-100 text-gray-800",
  SE: "bg-purple-100 text-purple-800",
  PT: "bg-green-100 text-green-800",
  RV: "bg-orange-100 text-orange-800",
}

const ESTADO_COLORS: Record<string, string> = {
  Activo: "bg-green-100 text-green-800",
  Inactivo: "bg-yellow-100 text-yellow-800",
  Descatalogado: "bg-red-100 text-red-800",
}

export default function InventarioPage() {
  const [view, setView] = useState<ViewMode>("list")
  const [productos, setProductos] = useState<Producto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editing, setEditing] = useState<Producto | null>(null)
  const [selectedForProveedores, setSelectedForProveedores] = useState<Producto | null>(null)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState("")
  const [filtroTipo, setFiltroTipo] = useState("")
  const [filtroSeccion, setFiltroSeccion] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("")
  const [filtroClase, setFiltroClase] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 50

  const loadProductos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (filtroTipo) params.set("tipo", filtroTipo)
      if (filtroSeccion) params.set("seccion", filtroSeccion)
      if (filtroEstado) params.set("estado", filtroEstado)
      if (filtroClase) params.set("claseAbc", filtroClase)
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))

      const res = await fetch(`/api/inventario/productos?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al cargar los productos")
      setProductos(data.productos)
      setTotal(data.total)
      setError(null)
    } catch {
      setError("Error al cargar los productos")
    } finally {
      setLoading(false)
    }
  }, [search, filtroTipo, filtroSeccion, filtroEstado, filtroClase, page])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadProductos()
  }, [loadProductos])

  useEffect(() => {
    setPage(1)
  }, [search, filtroTipo, filtroSeccion, filtroEstado, filtroClase])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleCreate(data: Record<string, unknown>) {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/inventario/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al crear el producto")
        return false
      }
      setSuccess("Producto creado correctamente")
      setView("list")
      loadProductos()
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
    const productData = { ...data }
    delete productData.confirmarDuplicado
    try {
      const res = await fetch(`/api/inventario/productos/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      })
      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al actualizar el producto")
        return false
      }
      setSuccess("Producto actualizado correctamente")
      setView("list")
      setEditing(null)
      loadProductos()
      return true
    } catch {
      setError("Error al conectar con el servidor")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Estás seguro de que quieres eliminar este producto?")) return
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/inventario/productos/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al eliminar el producto")
        return
      }
      setSuccess("Producto eliminado")
      loadProductos()
    } catch {
      setError("Error al conectar con el servidor")
    }
  }

  const totalPages = Math.ceil(total / pageSize)

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
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setView("create"); setEditing(null) }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Nuevo producto
            </button>
            <button
              onClick={() => setView("catalogos")}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Catálogos
            </button>
            <button
              onClick={() => setView("proveedores")}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Proveedores
            </button>
            <button
              onClick={() => setView("recepciones")}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Recepciones
            </button>
            <button
              onClick={() => setView("inventario-fisico")}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Inventario Físico
            </button>
            <span className="ml-auto text-sm text-gray-500">
              {total} producto{total !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código o descripción..."
              className="flex-1 min-w-[200px] rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900">
              <option value="">Todos los tipos</option>
              <option value="MP">MP - Materia prima</option>
              <option value="IN">IN - Insumo</option>
              <option value="SE">SE - Semielaborado</option>
              <option value="PT">PT - Producto terminado</option>
              <option value="RV">RV - Reventa</option>
            </select>
            <select value={filtroSeccion} onChange={(e) => setFiltroSeccion(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900">
              <option value="">Todas las secciones</option>
              <option value="Panadería">Panadería</option>
              <option value="Pastelería/Obrador">Pastelería/Obrador</option>
              <option value="Salados">Salados</option>
              <option value="Cafetería">Cafetería</option>
              <option value="Reventa">Reventa</option>
              <option value="General">General</option>
            </select>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900">
              <option value="">Todos los estados</option>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
              <option value="Descatalogado">Descatalogado</option>
            </select>
            <select value={filtroClase} onChange={(e) => setFiltroClase(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900">
              <option value="">Todas las clases</option>
              <option value="A">Clase A</option>
              <option value="B">Clase B</option>
              <option value="C">Clase C</option>
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Cargando productos...</p>
          ) : productos.length === 0 ? (
            <p className="text-sm text-gray-500">No se encontraron productos.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border bg-white">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500">
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Descripción</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Familia</th>
                      <th className="px-3 py-2">Proveedor</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Clase</th>
                      <th className="px-3 py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {productos.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs text-gray-900">{p.codigo}</td>
                        <td className="px-3 py-2 text-gray-900">{p.descripcionTpv}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_COLORS[p.tipoArticulo] || ""}`}>
                            {p.tipoArticulo}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{p.familia}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {p.proveedores && p.proveedores.length > 0
                            ? p.proveedores[0].proveedor.razonSocial
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLORS[p.estado] || ""}`}>
                            {p.estado}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{p.claseAbc || "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => { setEditing(p); setView("edit") }}
                            className="mr-2 text-xs font-medium text-blue-600 hover:text-blue-800"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => { setSelectedForProveedores(p); setView("producto-proveedores") }}
                            className="mr-2 text-xs font-medium text-purple-600 hover:text-purple-800"
                          >
                            Proveedores
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="text-xs font-medium text-red-600 hover:text-red-800"
                          >
                            Eliminar
                          </button>
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
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Nuevo producto</h2>
          <ProductoForm onSubmit={handleCreate} onCancel={() => setView("list")} saving={saving} />
        </div>
      )}

      {view === "edit" && editing && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Editar: {editing.codigo}
          </h2>
          <ProductoForm
            initialValues={editing}
            onSubmit={handleUpdate}
            onCancel={() => { setView("list"); setEditing(null) }}
            saving={saving}
          />
        </div>
      )}

      {view === "catalogos" && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Gestión de catálogos</h2>
            <button
              onClick={() => setView("list")}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Volver
            </button>
          </div>
          <CatalogoManager />
        </div>
      )}

      {view === "proveedores" && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Gestión de proveedores</h2>
            <button
              onClick={() => setView("list")}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Volver
            </button>
          </div>
          <ProveedoresPanel />
        </div>
      )}

      {view === "producto-proveedores" && selectedForProveedores && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <ProveedorProductoPanel
            productoId={selectedForProveedores.id}
            productoCodigo={selectedForProveedores.codigo}
            onClose={() => { setView("list"); setSelectedForProveedores(null); loadProductos() }}
          />
        </div>
      )}

      {view === "recepciones" && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recepciones de Inventario</h2>
            <button
              onClick={() => setView("list")}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Volver
            </button>
          </div>
          <RecepcionesPanel />
        </div>
      )}

      {view === "inventario-fisico" && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Inventario Físico</h2>
            <button
              onClick={() => setView("list")}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Volver
            </button>
          </div>
          <InventarioFisicoPanel />
        </div>
      )}
    </div>
  )
}
