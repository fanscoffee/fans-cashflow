"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"

interface Producto {
  id: string
  codigo: string
  descripcionTpv: string
  umCompra: string | null
  umBaseStock: string
  factorCompraABase: number | null
}

interface InventarioFisico {
  id: string
  fechaConteo: string
  notas: string | null
  creadoBy: { name: string } | null
  _count: { lineas: number }
}

interface ComparacionLinea {
  producto: {
    id: string
    codigo: string
    descripcionTpv: string
    umCompra: string | null
    umBaseStock: string
    factorCompraABase: number | null
  }
  cantidadUm1: number
  cantidadUm2: number
  anterior: number
  recibido: number
  actual: number
  diferencia: number
}

function ProductoCombobox({
  productos,
  value,
  onSelect,
}: {
  productos: Producto[]
  value: string
  onSelect: (productoId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = productos.find((p) => p.id === value)

  const filtered = productos.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.codigo.toLowerCase().includes(q) ||
      p.descripcionTpv.toLowerCase().includes(q)
    )
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleSelect(id: string) {
    onSelect(id)
    setOpen(false)
    setSearch("")
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false)
      setSearch("")
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        readOnly
        value={selected ? `${selected.codigo} - ${selected.descripcionTpv}` : ""}
        placeholder="Buscar producto..."
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        className="w-full cursor-pointer rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="sticky top-0 bg-white p-1">
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribir para filtrar..."
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {filtered.length === 0 ? (
            <div className="px-2 py-1 text-xs text-gray-500">Sin resultados</div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(p.id)}
                className={`block w-full px-2 py-1 text-left text-xs hover:bg-blue-50 ${
                  p.id === value ? "bg-blue-100 font-medium" : ""
                }`}
              >
                <span className="font-mono">{p.codigo}</span>{" "}
                <span className="text-gray-600">{p.descripcionTpv}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function InventarioFisicoPanel() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"

  const [view, setView] = useState<"list" | "create" | "detail">("list")
  const [inventarios, setInventarios] = useState<InventarioFisico[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [saving, setSaving] = useState(false)

  const [productos, setProductos] = useState<Producto[]>([])
  const [lineas, setLineas] = useState<Record<string, { cantidadUm1: string; cantidadUm2: string }>>({})
  const [notas, setNotas] = useState("")

  const [selectedInventario, setSelectedInventario] = useState<InventarioFisico | null>(null)
  const [comparacion, setComparacion] = useState<ComparacionLinea[] | null>(null)
  const [inventarioAnterior, setInventarioAnterior] = useState<{ id: string; fechaConteo: string } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const pageSize = 20

  const loadInventarios = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))
      const r = await fetch(`/api/inventario/inventario-fisico?${params}`)
      if (!r.ok) throw new Error("Error al cargar inventarios")
      const d = await r.json()
      setInventarios(d.inventarios || [])
      setTotal(d.total || 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [page])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (view === "list") loadInventarios()
  }, [view, loadInventarios])
  /* eslint-enable react-hooks/set-state-in-effect */

  const loadProductos = useCallback(async () => {
    try {
      const r = await fetch("/api/inventario/inventario-fisico/productos")
      const d = await r.json()
      setProductos(d.productos || [])
      const initial: Record<string, { cantidadUm1: string; cantidadUm2: string }> = {}
      for (const p of d.productos || []) {
        initial[p.id] = { cantidadUm1: "0", cantidadUm2: "0" }
      }
      setLineas(initial)
    } catch {
      setProductos([])
    }
  }, [])

  const handleCreate = async () => {
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      const lineasArray = Object.entries(lineas)
        .filter(([, v]) => v.cantidadUm1 !== "" || v.cantidadUm2 !== "")
        .map(([productoId, v]) => ({
          productoId,
          cantidadUm1: parseFloat(v.cantidadUm1) || 0,
          cantidadUm2: parseFloat(v.cantidadUm2) || 0,
        }))

      if (lineasArray.length === 0) {
        throw new Error("Debe ingresar al menos una cantidad")
      }

      const r = await fetch("/api/inventario/inventario-fisico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notas: notas || null, lineas: lineasArray }),
      })
      if (!r.ok) {
        const d = await r.json()
        throw new Error(d.error || "Error al crear inventario")
      }
      setSuccess("Inventario registrado correctamente")
      setView("list")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setSaving(false)
    }
  }

  const handleViewDetail = async (id: string) => {
    setDetailLoading(true)
    setError("")
    try {
      const r = await fetch(`/api/inventario/inventario-fisico/${id}/comparacion`)
      if (!r.ok) throw new Error("Error al cargar comparación")
      const d = await r.json()
      setComparacion(d.comparacion || [])
      setSelectedInventario(d.inventario)
      setInventarioAnterior(d.inventarioAnterior)
      setView("detail")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este conteo de inventario?")) return
    setError("")
    setSuccess("")
    try {
      const r = await fetch(`/api/inventario/inventario-fisico/${id}`, { method: "DELETE" })
      if (!r.ok) {
        const d = await r.json()
        throw new Error(d.error || "Error al eliminar")
      }
      setSuccess("Inventario eliminado")
      loadInventarios()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    }
  }

  const handleStartCreate = async () => {
    setNotas("")
    setComparacion(null)
    setSelectedInventario(null)
    setInventarioAnterior(null)
    await loadProductos()
    setView("create")
  }

  const totalPages = Math.ceil(total / pageSize)

  if (view === "create") {
    return (
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Nuevo conteo de inventario</h2>
          <button
            onClick={() => setView("list")}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Volver
          </button>
        </div>
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Notas</label>
          <input
            type="text"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Observaciones opcionales..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="overflow-x-auto rounded-md border bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500">
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2 w-24">UoM Compra</th>
                <th className="px-3 py-2 w-24">Cant. Um1</th>
                <th className="px-3 py-2 w-24">UoM Base</th>
                <th className="px-3 py-2 w-24">Cant. Um2</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {productos.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <ProductoCombobox
                      productos={productos}
                      value={p.id}
                      onSelect={() => {}}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{p.umCompra || "\u2014"}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={lineas[p.id]?.cantidadUm1 || ""}
                      onChange={(e) =>
                        setLineas((prev) => ({
                          ...prev,
                          [p.id]: { ...prev[p.id], cantidadUm1: e.target.value },
                        }))
                      }
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{p.umBaseStock}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={lineas[p.id]?.cantidadUm2 || ""}
                      onChange={(e) =>
                        setLineas((prev) => ({
                          ...prev,
                          [p.id]: { ...prev[p.id], cantidadUm2: e.target.value },
                        }))
                      }
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleCreate}
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar conteo"}
          </button>
          <button
            onClick={() => setView("list")}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  if (view === "detail" && selectedInventario) {
    return (
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Conteo: {new Date(selectedInventario.fechaConteo).toLocaleDateString("es-ES")}
          </h2>
          <button
            onClick={() => { setView("list"); setSelectedInventario(null); setComparacion(null) }}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Volver
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <span className="text-gray-500">Fecha</span>
            <p className="font-medium text-gray-900">
              {new Date(selectedInventario.fechaConteo).toLocaleDateString("es-ES")}
            </p>
          </div>
          {inventarioAnterior && (
            <div>
              <span className="text-gray-500">Conteo anterior</span>
              <p className="font-medium text-gray-900">
                {new Date(inventarioAnterior.fechaConteo).toLocaleDateString("es-ES")}
              </p>
            </div>
          )}
          {selectedInventario.notas && (
            <div>
              <span className="text-gray-500">Notas</span>
              <p className="font-medium text-gray-900">{selectedInventario.notas}</p>
            </div>
          )}
        </div>

        {detailLoading ? (
          <p className="text-sm text-gray-500">Cargando comparaci&oacute;n...</p>
        ) : comparacion && comparacion.length > 0 ? (
          <div className="overflow-x-auto rounded-md border bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500">
                  <th className="px-3 py-2">C&oacute;digo</th>
                  <th className="px-3 py-2">Producto</th>
                  {inventarioAnterior && (
                    <>
                      <th className="px-3 py-2 text-right">Anterior</th>
                      <th className="px-3 py-2 text-right">Recibido</th>
                    </>
                  )}
                  <th className="px-3 py-2 text-right">Actual</th>
                  <th className="px-3 py-2 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {comparacion.map((c) => (
                  <tr key={c.producto.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-900">{c.producto.codigo}</td>
                    <td className="px-3 py-2 text-gray-900">{c.producto.descripcionTpv}</td>
                    {inventarioAnterior && (
                      <>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {c.anterior} {c.producto.umBaseStock}
                        </td>
                        <td className="px-3 py-2 text-right text-green-600">
                          +{c.recibido} {c.producto.umBaseStock}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      {c.actual} {c.producto.umBaseStock}
                    </td>
                    <td className={`px-3 py-2 text-right font-medium ${c.diferencia >= 0 ? "text-orange-600" : "text-red-600"}`}>
                      {c.diferencia >= 0 ? "-" : "+"}{Math.abs(c.diferencia)} {c.producto.umBaseStock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No hay datos de comparaci&oacute;n.</p>
        )}

        {isAdmin && (
          <div className="mt-4">
            <button
              onClick={() => handleDelete(selectedInventario.id)}
              className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Eliminar conteo
            </button>
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

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleStartCreate}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nuevo conteo
        </button>
        <span className="ml-auto text-sm text-gray-500">
          {total} conteo{total !== 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando inventarios...</p>
      ) : inventarios.length === 0 ? (
        <p className="text-sm text-gray-500">No hay conteos de inventario registrados.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500">
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Creado por</th>
                  <th className="px-3 py-2 text-center">Productos</th>
                  <th className="px-3 py-2">Notas</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inventarios.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900">
                      {new Date(inv.fechaConteo).toLocaleDateString("es-ES")}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{inv.creadoBy?.name || "\u2014"}</td>
                    <td className="px-3 py-2 text-center text-gray-600">{inv._count.lineas}</td>
                    <td className="px-3 py-2 text-gray-600">{inv.notas || "\u2014"}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleViewDetail(inv.id)}
                        className="mr-2 text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        Ver
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(inv.id)}
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
                P&aacute;gina {page} de {totalPages}
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
