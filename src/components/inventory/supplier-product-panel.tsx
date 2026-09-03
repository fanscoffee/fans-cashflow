"use client"

import { useState, useEffect, useCallback } from "react"

interface Supplier {
  id: string
  legalName: string
  taxId: string
}

interface SupplierRelation {
  id: string
  supplierId: string
  supplier: Supplier
  supplierReference: string | null
  purchasePriceExcludingVat: number | null
  deliveryLeadTimeDays: number | null
  minimumOrder: number | null
  isPrimary: boolean
  active: boolean
}

interface Props {
  productId: string
  productCode: string
  onClose: () => void
}

export default function SupplierProductPanel({ productId, productCode, onClose }: Props) {
  const [relations, setRelations] = useState<SupplierRelation[]>([])
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAssign, setShowAssign] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState("")
  const [supplierReference, setSupplierReference] = useState("")
  const [purchasePrice, setPurchasePrice] = useState("")
  const [deliveryLeadTime, setDeliveryLeadTime] = useState("")
  const [minimumOrder, setMinimumOrder] = useState("")
  const [isPrimary, setIsPrimary] = useState(false)
  const [searchAssigned, setSearchAssigned] = useState("")
  const [searchAvailable, setSearchAvailable] = useState("")

  const loadRelations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventario/productos/${productId}/proveedores`)
      if (res.ok) {
        setRelations(await res.json())
      }
    } catch {
      setError("Error al cargar los proveedores")
    } finally {
      setLoading(false)
    }
  }, [productId])

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await fetch("/api/inventario/proveedores?pageSize=500&status=Activo")
      if (res.ok) {
        const data = await res.json()
        setAllSuppliers(data.suppliers)
      }
    } catch { /* empty */ }
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadRelations()
    loadSuppliers()
  }, [loadRelations, loadSuppliers])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleAssign() {
    if (!selectedSupplierId) {
      setError("Selecciona un proveedor")
      return
    }
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/inventario/productos/${productId}/proveedores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          supplierReference: supplierReference || null,
          purchasePriceExcludingVat: purchasePrice ? Number(purchasePrice) : null,
          deliveryLeadTimeDays: deliveryLeadTime ? Number(deliveryLeadTime) : null,
          minimumOrder: minimumOrder ? Number(minimumOrder) : null,
          isPrimary,
        }),
      })
      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al asignar")
        return
      }
      setSuccess("Proveedor asignado correctamente")
      setShowAssign(false)
      resetForm()
      loadRelations()
    } catch {
      setError("Error al conectar con el servidor")
    }
  }

  async function handleRemove(relationId: string) {
    if (!confirm("¿Desasignar este proveedor del producto?")) return
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/inventario/productos/${productId}/proveedores?relationId=${relationId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al desasignar")
        return
      }
      setSuccess("Proveedor desasignado")
      loadRelations()
    } catch {
      setError("Error al conectar con el servidor")
    }
  }

  async function handleTogglePrimary(relation: SupplierRelation) {
    try {
      const res = await fetch(`/api/inventario/productos/${productId}/proveedores`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relationId: relation.id,
          isPrimary: !relation.isPrimary,
        }),
      })
      if (res.ok) loadRelations()
    } catch {
      setError("Error al actualizar")
    }
  }

  function resetForm() {
    setSelectedSupplierId("")
    setSupplierReference("")
    setPurchasePrice("")
    setDeliveryLeadTime("")
    setMinimumOrder("")
    setIsPrimary(false)
  }

  const assignedIds = new Set(relations.map((r) => r.supplierId))
  const availableSuppliers = allSuppliers.filter((p) => !assignedIds.has(p.id) && (
    !searchAvailable || p.legalName.toLowerCase().includes(searchAvailable.toLowerCase()) || p.taxId.toLowerCase().includes(searchAvailable.toLowerCase())
  ))
  const filteredRelations = relations.filter((r) =>
    !searchAssigned || r.supplier.legalName.toLowerCase().includes(searchAssigned.toLowerCase()) || (r.supplierReference && r.supplierReference.toLowerCase().includes(searchAssigned.toLowerCase()))
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Proveedores de <span className="font-mono">{productCode}</span>
        </h3>
        <button onClick={onClose} className="min-h-11 w-full rounded-md border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 sm:min-h-0 sm:w-auto sm:border-0 sm:px-0 sm:py-0">
          Cerrar
        </button>
      </div>

      {error && <div className="rounded-md bg-red-50 p-2 text-xs text-red-600">{error}</div>}
      {success && <div className="rounded-md bg-green-50 p-2 text-xs text-green-600">{success}</div>}

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
          {relations.length} proveedor{relations.length !== 1 ? "es" : ""} asignado{relations.length !== 1 ? "s" : ""}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {relations.length > 0 && (
            <input
              type="text"
              value={searchAssigned}
              onChange={(e) => setSearchAssigned(e.target.value)}
              placeholder="Buscar proveedor..."
              className="w-full rounded-md border border-gray-300 px-2 py-2 text-xs text-gray-900 sm:w-40 sm:py-1"
            />
          )}
          <button
            onClick={() => setShowAssign(!showAssign)}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 sm:w-auto sm:py-1.5"
          >
            {showAssign ? "Cancelar" : "+ Asignar proveedor"}
          </button>
        </div>
      </div>

      {showAssign && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <input
                type="text"
                value={searchAvailable}
                onChange={(e) => setSearchAvailable(e.target.value)}
                placeholder="Buscar proveedor disponible..."
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 w-full"
              />
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 w-full"
              >
                <option value="">Seleccionar proveedor...</option>
                {availableSuppliers.map((p) => (
                  <option key={p.id} value={p.id}>{p.legalName} ({p.taxId})</option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={supplierReference}
              onChange={(e) => setSupplierReference(e.target.value)}
              placeholder="Ref. proveedor"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
            />
            <input
              type="number"
              step="0.01"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="Precio compra sin IVA (€)"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
            />
            <input
              type="number"
              value={deliveryLeadTime}
              onChange={(e) => setDeliveryLeadTime(e.target.value)}
              placeholder="Plazo entrega (días)"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
            />
            <input
              type="number"
              step="0.01"
              value={minimumOrder}
              onChange={(e) => setMinimumOrder(e.target.value)}
              placeholder="Pedido mínimo (€)"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">Proveedor principal</span>
            </label>
          </div>
          <button
            onClick={handleAssign}
            className="w-full rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 sm:w-auto sm:py-1.5"
          >
            Asignar
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : relations.length === 0 ? (
        <p className="text-sm text-gray-500">No hay proveedores asignados a este producto.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-white">
          <table className="w-full min-w-max text-left text-sm sm:min-w-0">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500">
                <th className="px-3 py-2">Proveedor</th>
                <th className="px-3 py-2">Ref.</th>
                <th className="px-3 py-2">Precio (€ s/IVA)</th>
                <th className="px-3 py-2">Plazo entrega</th>
                <th className="px-3 py-2">Pedido mín.</th>
                <th className="px-3 py-2">Principal</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRelations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{r.supplier.legalName}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{r.supplierReference || "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{r.purchasePriceExcludingVat != null ? `${Number(r.purchasePriceExcludingVat).toFixed(2)} €` : "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{r.deliveryLeadTimeDays != null ? `${r.deliveryLeadTimeDays} días` : "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{r.minimumOrder != null ? `${Number(r.minimumOrder).toFixed(2)} €` : "—"}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleTogglePrimary(r)}
                      className={`text-xs font-medium ${r.isPrimary ? "text-yellow-600" : "text-gray-400 hover:text-yellow-600"}`}
                    >
                      {r.isPrimary ? "★ Principal" : "☆ Hacer principal"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleRemove(r.id)}
                      className="text-xs font-medium text-red-600 hover:text-red-800"
                    >
                      Desasignar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
