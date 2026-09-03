"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { UserRole } from "@/lib/database-enums"
import { isRole } from "@/lib/roles"

interface Product {
  id: string
  code: string
  posDescription: string
  purchaseUnit: string | null
  baseStockUnit: string
  purchaseToBaseFactor: number | null
}

interface PhysicalInventory {
  id: string
  countedAt: string
  notes: string | null
  createdBy: { name: string } | null
  _count: { lines: number }
}

interface ComparisonLine {
  product: {
    id: string
    code: string
    posDescription: string
    purchaseUnit: string | null
    baseStockUnit: string
    purchaseToBaseFactor: number | null
  }
  quantityUnit1: number
  quantityUnit2: number
  previous: number
  received: number
  actual: number
  variance: number
}

function ProductCombobox({
  products,
  value,
  onSelect,
}: {
  products: Product[]
  value: string
  onSelect: (productId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = products.find((p) => p.id === value)

  const filtered = products.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.code.toLowerCase().includes(q) ||
      p.posDescription.toLowerCase().includes(q)
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
        value={selected ? `${selected.code} - ${selected.posDescription}` : ""}
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
                <span className="font-mono">{p.code}</span>{" "}
                <span className="text-gray-600">{p.posDescription}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function PhysicalInventoryPanel() {
  const { data: session } = useSession()
  const isAdmin = isRole(session?.user?.role, UserRole.ADMIN)

  const [view, setView] = useState<"list" | "create" | "detail">("list")
  const [inventories, setInventories] = useState<PhysicalInventory[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [saving, setSaving] = useState(false)

  const [products, setProducts] = useState<Product[]>([])
  const [lines, setLines] = useState<Record<string, { quantityUnit1: string; quantityUnit2: string }>>({})
  const [notes, setNotes] = useState("")

  const [selectedInventory, setSelectedInventory] = useState<PhysicalInventory | null>(null)
  const [comparison, setComparison] = useState<ComparisonLine[] | null>(null)
  const [previousInventory, setPreviousInventory] = useState<{ id: string; countedAt: string } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const pageSize = 20

  const loadInventories = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))
      const r = await fetch(`/api/inventario/inventario-fisico?${params}`)
      if (!r.ok) throw new Error("Error al cargar inventarios")
      const d = await r.json()
      setInventories(d.inventories || [])
      setTotal(d.total || 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [page])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (view === "list") loadInventories()
  }, [view, loadInventories])
  /* eslint-enable react-hooks/set-state-in-effect */

  const loadProducts = useCallback(async () => {
    try {
      const r = await fetch("/api/inventario/inventario-fisico/productos")
      const d = await r.json()
      setProducts(d.products || [])
      const initial: Record<string, { quantityUnit1: string; quantityUnit2: string }> = {}
      for (const p of d.products || []) {
        initial[p.id] = { quantityUnit1: "0", quantityUnit2: "0" }
      }
      setLines(initial)
    } catch {
      setProducts([])
    }
  }, [])

  const handleCreate = async () => {
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      const linesArray = Object.entries(lines)
        .filter(([, v]) => v.quantityUnit1 !== "" || v.quantityUnit2 !== "")
        .map(([productId, v]) => ({
          productId,
          quantityUnit1: parseFloat(v.quantityUnit1) || 0,
          quantityUnit2: parseFloat(v.quantityUnit2) || 0,
        }))

      if (linesArray.length === 0) {
        throw new Error("Debe ingresar al menos una cantidad")
      }

      const r = await fetch("/api/inventario/inventario-fisico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes || null, lines: linesArray }),
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
      setComparison(d.comparison || d.comparacion || [])
      setSelectedInventory(d.inventory)
      setPreviousInventory(d.previousInventory || d.inventoryAnterior)
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
      loadInventories()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    }
  }

  const handleStartCreate = async () => {
    setNotes("")
    setComparison(null)
    setSelectedInventory(null)
    setPreviousInventory(null)
    await loadProducts()
    setView("create")
  }

  const totalPages = Math.ceil(total / pageSize)

  if (view === "create") {
    return (
      <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Nuevo conteo de inventario</h2>
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

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Notas</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observaciones opcionales..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="overflow-x-auto rounded-md border bg-white">
          <table className="w-full min-w-max text-left text-sm sm:min-w-0">
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
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <ProductCombobox
                      products={products}
                      value={p.id}
                      onSelect={() => {}}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{p.purchaseUnit || "\u2014"}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={lines[p.id]?.quantityUnit1 || ""}
                      onChange={(e) =>
                        setLines((prev) => ({
                          ...prev,
                          [p.id]: { ...prev[p.id], quantityUnit1: e.target.value },
                        }))
                      }
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{p.baseStockUnit}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={lines[p.id]?.quantityUnit2 || ""}
                      onChange={(e) =>
                        setLines((prev) => ({
                          ...prev,
                          [p.id]: { ...prev[p.id], quantityUnit2: e.target.value },
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

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={handleCreate}
            disabled={saving}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
          >
            {saving ? "Guardando..." : "Guardar conteo"}
          </button>
          <button
            onClick={() => setView("list")}
            className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  if (view === "detail" && selectedInventory) {
    return (
      <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Conteo: {new Date(selectedInventory.countedAt).toLocaleDateString("es-ES")}
          </h2>
          <button
            onClick={() => { setView("list"); setSelectedInventory(null); setComparison(null) }}
            className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
          >
            Volver
          </button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 text-sm min-[420px]:grid-cols-2 sm:grid-cols-3">
          <div>
            <span className="text-gray-500">Fecha</span>
            <p className="font-medium text-gray-900">
              {new Date(selectedInventory.countedAt).toLocaleDateString("es-ES")}
            </p>
          </div>
          {previousInventory && (
            <div>
              <span className="text-gray-500">Conteo anterior</span>
              <p className="font-medium text-gray-900">
                {new Date(previousInventory.countedAt).toLocaleDateString("es-ES")}
              </p>
            </div>
          )}
          {selectedInventory.notes && (
            <div>
              <span className="text-gray-500">Notas</span>
              <p className="font-medium text-gray-900">{selectedInventory.notes}</p>
            </div>
          )}
        </div>

        {detailLoading ? (
          <p className="text-sm text-gray-500">Cargando comparaci&oacute;n...</p>
        ) : comparison && comparison.length > 0 ? (
          <div className="overflow-x-auto rounded-md border bg-white">
            <table className="w-full min-w-max text-left text-sm sm:min-w-0">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500">
                  <th className="px-3 py-2">C&oacute;digo</th>
                  <th className="px-3 py-2">Producto</th>
                  {previousInventory && (
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
                {comparison.map((c) => (
                  <tr key={c.product.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-900">{c.product.code}</td>
                    <td className="px-3 py-2 text-gray-900">{c.product.posDescription}</td>
                    {previousInventory && (
                      <>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {c.previous} {c.product.baseStockUnit}
                        </td>
                        <td className="px-3 py-2 text-right text-green-600">
                          +{c.received} {c.product.baseStockUnit}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      {c.actual} {c.product.baseStockUnit}
                    </td>
                    <td className={`px-3 py-2 text-right font-medium ${c.variance >= 0 ? "text-orange-600" : "text-red-600"}`}>
                      {c.variance >= 0 ? "-" : "+"}{Math.abs(c.variance)} {c.product.baseStockUnit}
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
              onClick={() => handleDelete(selectedInventory.id)}
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

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          onClick={handleStartCreate}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
        >
          + Nuevo conteo
        </button>
        <span className="text-center text-sm text-gray-500 sm:ml-auto">
          {total} conteo{total !== 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando inventarios...</p>
      ) : inventories.length === 0 ? (
        <p className="text-sm text-gray-500">No hay conteos de inventario registrados.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border bg-white">
            <table className="w-full min-w-max text-left text-sm sm:min-w-0">
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
                {inventories.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900">
                      {new Date(inv.countedAt).toLocaleDateString("es-ES")}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{inv.createdBy?.name || "\u2014"}</td>
                    <td className="px-3 py-2 text-center text-gray-600">{inv._count.lines}</td>
                    <td className="px-3 py-2 text-gray-600">{inv.notes || "\u2014"}</td>
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
