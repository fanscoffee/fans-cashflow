"use client"

import { useState, useEffect, useCallback } from "react"
import ProductForm from "@/components/inventory/product-form"
import CatalogManager from "@/components/inventory/catalog-manager"
import SuppliersPanel from "@/components/inventory/suppliers-panel"
import SupplierProductPanel from "@/components/inventory/supplier-product-panel"
import ReceiptsPanel from "@/components/inventory/receipts-panel"
import PhysicalInventoryPanel from "@/components/inventory/physical-inventory-panel"

interface InventoryPageProps {
  canDeleteProductsAndSuppliers?: boolean
}

interface SupplierRelation {
  id: string
  supplierId: string
  supplier: { id: string; legalName: string }
  isPrimary: boolean
}

interface Product {
  id: string
  code: string
  eanBarcode: string | null
  posDescription: string
  fullDescription: string
  itemType: string
  family: string
  subfamily: string | null
  section: string
  isPurchasable: boolean
  isPrepared: boolean
  isSellable: boolean
  hasRecipe: boolean
  baseStockUnit: string
  purchaseUnit: string | null
  purchaseToBaseFactor: number | null
  salesUnit: string | null
  salesToBaseFactor: number | null
  netWeightPerUnitGrams: number | null
  presentationFormat: string | null
  baseUnitCost: number | null
  costIncludingVat: number | null
  standardWastePercentage: number | null
  vatCode: string
  vatPercentage: number | null
  purchaseVatPercentage: number | null
  salesVatPercentage: number | null
  pricingMethod: string
  targetMarginPercentage: number | null
  targetRetailPriceIncludingVat: number | null
  fixedRetailPriceIncludingVat: number | null
  appliedRetailPriceIncludingVat: number | null
  appliedRetailPriceExcludingVat: number | null
  profitPerUnit: number | null
  actualMarginPercentage: number | null
  percentagePointDeviation: number | null
  unitDifference: number | null
  pricingDiagnosis: string | null
  stockControl: string
  valuationMethod: string
  minimumStock: number | null
  maximumStock: number | null
  reorderPoint: number | null
  location: string | null
  abcClass: string | null
  batchControl: string
  shelfLifeDays: number | null
  storageConditions: string | null
  allergens: string | null
  status: string
  addedAt: string
  notes: string | null
  suppliers?: SupplierRelation[]
}

type ViewMode = "list" | "create" | "edit" | "catalogs" | "suppliers" | "product-suppliers" | "receipts" | "physical-inventory"

const TYPE_COLORS: Record<string, string> = {
  MP: "bg-blue-100 text-blue-800",
  IN: "bg-gray-100 text-gray-800",
  SE: "bg-purple-100 text-purple-800",
  PT: "bg-green-100 text-green-800",
  RV: "bg-orange-100 text-orange-800",
}

const STATUS_COLORS: Record<string, string> = {
  Activo: "bg-green-100 text-green-800",
  Inactivo: "bg-yellow-100 text-yellow-800",
  Descatalogado: "bg-red-100 text-red-800",
}

export default function InventoryPage({ canDeleteProductsAndSuppliers = false }: InventoryPageProps) {
  const [view, setView] = useState<ViewMode>("list")
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [selectedForSuppliers, setSelectedForSuppliers] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [sectionFilter, setSectionFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [abcClassFilter, setAbcClassFilter] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 50

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (typeFilter) params.set("itemType", typeFilter)
      if (sectionFilter) params.set("section", sectionFilter)
      if (statusFilter) params.set("status", statusFilter)
      if (abcClassFilter) params.set("abcClass", abcClassFilter)
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))

      const res = await fetch(`/api/inventario/productos?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al cargar los productos")
      setProducts(data.products)
      setTotal(data.total)
      setError(null)
    } catch {
      setError("Error al cargar los productos")
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, sectionFilter, statusFilter, abcClassFilter, page])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    setPage(1)
  }, [search, typeFilter, sectionFilter, statusFilter, abcClassFilter])
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
      loadProducts()
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
    delete productData.confirmDuplicate
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
      loadProducts()
      return true
    } catch {
      setError("Error al conectar con el servidor")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!canDeleteProductsAndSuppliers) return
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
      loadProducts()
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
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              onClick={() => { setView("create"); setEditing(null) }}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
            >
              + Nuevo producto
            </button>
            <button
              onClick={() => setView("catalogs")}
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
            >
              Catálogos
            </button>
            <button
              onClick={() => setView("suppliers")}
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
            >
              Proveedores
            </button>
            <button
              onClick={() => setView("receipts")}
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
            >
              Recepciones
            </button>
            <button
              onClick={() => setView("physical-inventory")}
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
            >
              Inventario Físico
            </button>
            <span className="text-center text-sm text-gray-500 sm:ml-auto">
              {total} producto{total !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código o descripción..."
              className="w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:min-w-[200px] sm:flex-1"
            />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 sm:w-auto">
              <option value="">Todos los tipos</option>
              <option value="MP">MP - Materia prima</option>
              <option value="IN">IN - Insumo</option>
              <option value="SE">SE - Semielaborado</option>
              <option value="PT">PT - Producto terminado</option>
              <option value="RV">RV - Reventa</option>
            </select>
            <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 sm:w-auto">
              <option value="">Todas las secciones</option>
              <option value="Panadería">Panadería</option>
              <option value="Pastelería/Obrador">Pastelería/Obrador</option>
              <option value="Salados">Salados</option>
              <option value="Cafetería">Cafetería</option>
              <option value="Reventa">Reventa</option>
              <option value="General">General</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 sm:w-auto">
              <option value="">Todos los estados</option>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
              <option value="Descatalogado">Descatalogado</option>
            </select>
            <select value={abcClassFilter} onChange={(e) => setAbcClassFilter(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 sm:w-auto">
              <option value="">Todas las clases</option>
              <option value="A">Clase A</option>
              <option value="B">Clase B</option>
              <option value="C">Clase C</option>
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Cargando productos...</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-gray-500">No se encontraron productos.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border bg-white">
                <table className="w-full min-w-max text-left text-sm sm:min-w-0">
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
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs text-gray-900">{p.code}</td>
                        <td className="px-3 py-2 text-gray-900">{p.posDescription}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[p.itemType] || ""}`}>
                            {p.itemType}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{p.family}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {p.suppliers && p.suppliers.length > 0
                            ? p.suppliers[0].supplier.legalName
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] || ""}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{p.abcClass || "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => { setEditing(p); setView("edit") }}
                            className="mr-2 text-xs font-medium text-blue-600 hover:text-blue-800"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => { setSelectedForSuppliers(p); setView("product-suppliers") }}
                            className="mr-2 text-xs font-medium text-purple-600 hover:text-purple-800"
                          >
                            Proveedores
                          </button>
                           {canDeleteProductsAndSuppliers && (
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
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Nuevo producto</h2>
          <ProductForm onSubmit={handleCreate} onCancel={() => setView("list")} saving={saving} />
        </div>
      )}

      {view === "edit" && editing && (
        <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Editar: {editing.code}
          </h2>
          <ProductForm
            initialValues={editing}
            onSubmit={handleUpdate}
            onCancel={() => { setView("list"); setEditing(null) }}
            saving={saving}
          />
        </div>
      )}

      {view === "catalogs" && (
        <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Gestión de catálogos</h2>
            <button
              onClick={() => setView("list")}
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
            >
              Volver
            </button>
          </div>
          <CatalogManager />
        </div>
      )}

      {view === "suppliers" && (
        <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Gestión de proveedores</h2>
            <button
              onClick={() => setView("list")}
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
            >
              Volver
            </button>
          </div>
           <SuppliersPanel canDelete={canDeleteProductsAndSuppliers} />
        </div>
      )}

      {view === "product-suppliers" && selectedForSuppliers && (
        <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
          <SupplierProductPanel
            productId={selectedForSuppliers.id}
            productCode={selectedForSuppliers.code}
            onClose={() => { setView("list"); setSelectedForSuppliers(null); loadProducts() }}
          />
        </div>
      )}

      {view === "receipts" && (
        <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recepciones de Inventario</h2>
            <button
              onClick={() => setView("list")}
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
            >
              Volver
            </button>
          </div>
          <ReceiptsPanel />
        </div>
      )}

      {view === "physical-inventory" && (
        <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Inventario Físico</h2>
            <button
              onClick={() => setView("list")}
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
            >
              Volver
            </button>
          </div>
          <PhysicalInventoryPanel />
        </div>
      )}
    </div>
  )
}
