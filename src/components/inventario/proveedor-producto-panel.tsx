"use client"

import { useState, useEffect, useCallback } from "react"

interface Proveedor {
  id: string
  razonSocial: string
  cifNif: string
}

interface ProveedorRelation {
  id: string
  proveedorId: string
  proveedor: Proveedor
  refProveedor: string | null
  precioCompraSinIva: number | null
  plazoEntregaDias: number | null
  pedidoMinimo: number | null
  esPrincipal: boolean
  activo: boolean
}

interface Props {
  productoId: string
  productoCodigo: string
  onClose: () => void
}

export default function ProveedorProductoPanel({ productoId, productoCodigo, onClose }: Props) {
  const [relaciones, setRelaciones] = useState<ProveedorRelation[]>([])
  const [allProveedores, setAllProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAssign, setShowAssign] = useState(false)
  const [selectedProveedorId, setSelectedProveedorId] = useState("")
  const [refProveedor, setRefProveedor] = useState("")
  const [precioCompra, setPrecioCompra] = useState("")
  const [plazoEntrega, setPlazoEntrega] = useState("")
  const [pedidoMinimo, setPedidoMinimo] = useState("")
  const [esPrincipal, setEsPrincipal] = useState(false)
  const [searchAssigned, setSearchAssigned] = useState("")
  const [searchAvailable, setSearchAvailable] = useState("")

  const loadRelaciones = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventario/productos/${productoId}/proveedores`)
      if (res.ok) {
        setRelaciones(await res.json())
      }
    } catch {
      setError("Error al cargar los proveedores")
    } finally {
      setLoading(false)
    }
  }, [productoId])

  const loadProveedores = useCallback(async () => {
    try {
      const res = await fetch("/api/inventario/proveedores?pageSize=500&estado=Activo")
      if (res.ok) {
        const data = await res.json()
        setAllProveedores(data.proveedores)
      }
    } catch { /* empty */ }
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadRelaciones()
    loadProveedores()
  }, [loadRelaciones, loadProveedores])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleAssign() {
    if (!selectedProveedorId) {
      setError("Selecciona un proveedor")
      return
    }
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/inventario/productos/${productoId}/proveedores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proveedorId: selectedProveedorId,
          refProveedor: refProveedor || null,
          precioCompraSinIva: precioCompra ? Number(precioCompra) : null,
          plazoEntregaDias: plazoEntrega ? Number(plazoEntrega) : null,
          pedidoMinimo: pedidoMinimo ? Number(pedidoMinimo) : null,
          esPrincipal,
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
      loadRelaciones()
    } catch {
      setError("Error al conectar con el servidor")
    }
  }

  async function handleRemove(relationId: string) {
    if (!confirm("¿Desasignar este proveedor del producto?")) return
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/inventario/productos/${productoId}/proveedores?relationId=${relationId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al desasignar")
        return
      }
      setSuccess("Proveedor desasignado")
      loadRelaciones()
    } catch {
      setError("Error al conectar con el servidor")
    }
  }

  async function handleTogglePrincipal(relation: ProveedorRelation) {
    try {
      const res = await fetch(`/api/inventario/productos/${productoId}/proveedores`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relationId: relation.id,
          esPrincipal: !relation.esPrincipal,
        }),
      })
      if (res.ok) loadRelaciones()
    } catch {
      setError("Error al actualizar")
    }
  }

  function resetForm() {
    setSelectedProveedorId("")
    setRefProveedor("")
    setPrecioCompra("")
    setPlazoEntrega("")
    setPedidoMinimo("")
    setEsPrincipal(false)
  }

  const assignedIds = new Set(relaciones.map((r) => r.proveedorId))
  const availableProveedores = allProveedores.filter((p) => !assignedIds.has(p.id) && (
    !searchAvailable || p.razonSocial.toLowerCase().includes(searchAvailable.toLowerCase()) || p.cifNif.toLowerCase().includes(searchAvailable.toLowerCase())
  ))
  const filteredRelaciones = relaciones.filter((r) =>
    !searchAssigned || r.proveedor.razonSocial.toLowerCase().includes(searchAssigned.toLowerCase()) || (r.refProveedor && r.refProveedor.toLowerCase().includes(searchAssigned.toLowerCase()))
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Proveedores de <span className="font-mono">{productoCodigo}</span>
        </h3>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700">
          Cerrar
        </button>
      </div>

      {error && <div className="rounded-md bg-red-50 p-2 text-xs text-red-600">{error}</div>}
      {success && <div className="rounded-md bg-green-50 p-2 text-xs text-green-600">{success}</div>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {relaciones.length} proveedor{relaciones.length !== 1 ? "es" : ""} asignado{relaciones.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          {relaciones.length > 0 && (
            <input
              type="text"
              value={searchAssigned}
              onChange={(e) => setSearchAssigned(e.target.value)}
              placeholder="Buscar proveedor..."
              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 w-40"
            />
          )}
          <button
            onClick={() => setShowAssign(!showAssign)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
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
                value={selectedProveedorId}
                onChange={(e) => setSelectedProveedorId(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 w-full"
              >
                <option value="">Seleccionar proveedor...</option>
                {availableProveedores.map((p) => (
                  <option key={p.id} value={p.id}>{p.razonSocial} ({p.cifNif})</option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={refProveedor}
              onChange={(e) => setRefProveedor(e.target.value)}
              placeholder="Ref. proveedor"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
            />
            <input
              type="number"
              step="0.01"
              value={precioCompra}
              onChange={(e) => setPrecioCompra(e.target.value)}
              placeholder="Precio compra sin IVA (€)"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
            />
            <input
              type="number"
              value={plazoEntrega}
              onChange={(e) => setPlazoEntrega(e.target.value)}
              placeholder="Plazo entrega (días)"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
            />
            <input
              type="number"
              step="0.01"
              value={pedidoMinimo}
              onChange={(e) => setPedidoMinimo(e.target.value)}
              placeholder="Pedido mínimo (€)"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={esPrincipal}
                onChange={(e) => setEsPrincipal(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">Proveedor principal</span>
            </label>
          </div>
          <button
            onClick={handleAssign}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
          >
            Asignar
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : relaciones.length === 0 ? (
        <p className="text-sm text-gray-500">No hay proveedores asignados a este producto.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-white">
          <table className="w-full text-left text-sm">
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
              {filteredRelaciones.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{r.proveedor.razonSocial}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{r.refProveedor || "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{r.precioCompraSinIva != null ? `${Number(r.precioCompraSinIva).toFixed(2)} €` : "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{r.plazoEntregaDias != null ? `${r.plazoEntregaDias} días` : "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{r.pedidoMinimo != null ? `${Number(r.pedidoMinimo).toFixed(2)} €` : "—"}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleTogglePrincipal(r)}
                      className={`text-xs font-medium ${r.esPrincipal ? "text-yellow-600" : "text-gray-400 hover:text-yellow-600"}`}
                    >
                      {r.esPrincipal ? "★ Principal" : "☆ Hacer principal"}
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
