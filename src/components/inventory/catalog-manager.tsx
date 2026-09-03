"use client"

import { useState, useEffect, useCallback } from "react"

interface CatalogItem {
  id: string
  type: string
  value: string
  description: string | null
  codePrefix: string | null
  active: boolean
}

const CATALOG_TYPES = [
  { type: "TIPO_ARTICULO", label: "Tipo de artículo" },
  { type: "SECCION", label: "Sección" },
  { type: "FAMILIA", label: "Familia" },
  { type: "SUBFAMILIA", label: "Subfamilia" },
  { type: "UNIDAD_MEDIDA", label: "Unidad de medida" },
  { type: "SI_NO", label: "Sí / No" },
  { type: "VALORACION", label: "Método valoración" },
  { type: "METODO_PRECIO", label: "Método de precio" },
  { type: "CLASE_ABC", label: "Clase ABC" },
  { type: "UBICACION", label: "Ubicación" },
  { type: "CONSERVACION", label: "Conservación" },
  { type: "ESTADO", label: "Estado" },
  { type: "CODIGO_IVA", label: "Código IVA" },
  { type: "ALERGENO", label: "Alérgeno" },
  { type: "PROVEEDOR", label: "Proveedor" },
]

export default function CatalogManager() {
  const [selectedType, setSelectedType] = useState(CATALOG_TYPES[0].type)
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newValue, setNewValue] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newPrefijoCode, setNewPrefijoCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventario/catalogos?type=${encodeURIComponent(selectedType)}`)
      if (res.ok) {
        setItems(await res.json())
      }
    } catch {
      setError("Error al cargar los catálogos")
    } finally {
      setLoading(false)
    }
  }, [selectedType])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setShowAdd(false)
    setNewValue("")
    setNewDescription("")
    setNewPrefijoCode("")
    setError(null)
    setSuccess(null)
  }, [selectedType])

  useEffect(() => {
    loadItems()
  }, [loadItems])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleAdd() {
    if (!newValue.trim()) {
      setError("El valor es obligatorio")
      return
    }
    const codePrefix = newPrefijoCode.trim().toUpperCase()
    if (selectedType === "FAMILIA" && !/^[A-Z]{3}$/.test(codePrefix)) {
      setError("El prefijo de familia debe tener 3 letras mayúsculas")
      return
    }
    setError(null)
    try {
      const res = await fetch("/api/inventario/catalogos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          value: newValue.trim(),
          description: newDescription.trim() || null,
          ...(selectedType === "FAMILIA" ? { codePrefix } : {}),
        }),
      })
      if (!res.ok) {
        const result = await res.json()
        setError(result.error)
        return
      }
      setNewValue("")
      setNewDescription("")
      setNewPrefijoCode("")
      setShowAdd(false)
      loadItems()
    } catch {
      setError("Error al crear el valor")
    }
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    if (currentActive) {
      if (!confirm("¿Desactivar este valor? No se eliminará, solo se marcará como inactivo.")) return
    }
    try {
      if (currentActive) {
        await fetch(`/api/inventario/catalogos/${id}`, { method: "DELETE" })
      } else {
        await fetch(`/api/inventario/catalogos/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: true }),
        })
      }
      loadItems()
    } catch {
      setError("Error al actualizar el catálogo")
    }
  }

  async function handleDeleteCatalog(id: string, value: string) {
    const catalogLabel = CATALOG_TYPES.find((catalog) => catalog.type === selectedType)?.label || selectedType
    if (!confirm(`¿Eliminar "${value}" del catálogo "${catalogLabel}"? Esta acción no se puede deshacer.`)) return

    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/inventario/catalogos/${id}?permanent=true`, { method: "DELETE" })
      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al eliminar el valor del catálogo")
        return
      }

      setSuccess(`"${value}" eliminado del catálogo "${catalogLabel}"`)
      await loadItems()
    } catch {
      setError("Error al conectar con el servidor")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CATALOG_TYPES.map((ct) => (
          <button
            key={ct.type}
            onClick={() => setSelectedType(ct.type)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              selectedType === ct.type
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {ct.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-2 text-xs text-red-600">{error}</div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-2 text-xs text-green-600">{success}</div>
      )}

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
          {items.length} valor{items.length !== 1 ? "es" : ""} en <span className="font-medium">{selectedType}</span>
        </p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 sm:w-auto sm:py-1.5"
        >
          {showAdd ? "Cancelar" : "+ Añadir valor"}
        </button>
      </div>

      {showAdd && (
        <div className="grid gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 sm:flex sm:items-center">
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Valor (ej: NuevoTipo)"
            className="min-w-0 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:flex-1 sm:py-1.5"
          />
          {selectedType === "FAMILIA" && (
            <input
              type="text"
              value={newPrefijoCode}
              onChange={(e) => setNewPrefijoCode(e.target.value.toUpperCase())}
              placeholder="Prefijo (HAR)"
              maxLength={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-32 sm:py-1.5"
            />
          )}
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Descripción (opcional)"
            className="min-w-0 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:flex-1 sm:py-1.5"
          />
          <button
            onClick={handleAdd}
            className="w-full rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 sm:w-auto sm:py-1.5"
          >
            Guardar
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No hay valores en este catálogo.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-white">
          <table className="w-full min-w-max text-left text-sm sm:min-w-0">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500">
                <th className="px-3 py-2">Valor</th>
                {selectedType === "FAMILIA" && <th className="px-3 py-2">Prefijo</th>}
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className={!item.active ? "opacity-50" : ""}>
                  <td className="px-3 py-2 font-mono text-xs text-gray-900">{item.value}</td>
                  {selectedType === "FAMILIA" && <td className="px-3 py-2 font-mono text-xs text-gray-900">{item.codePrefix || "—"}</td>}
                  <td className="px-3 py-2 text-gray-600">{item.description || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}>
                      {item.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-3">
                      <button
                        onClick={() => handleToggleActive(item.id, item.active)}
                        className={`text-xs font-medium ${item.active ? "text-red-600 hover:text-red-800" : "text-green-600 hover:text-green-800"}`}
                      >
                        {item.active ? "Desactivar" : "Reactivar"}
                      </button>
                      <button
                        onClick={() => handleDeleteCatalog(item.id, item.value)}
                        className="text-xs font-medium text-red-800 hover:text-red-950"
                      >
                        Eliminar
                      </button>
                    </div>
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
