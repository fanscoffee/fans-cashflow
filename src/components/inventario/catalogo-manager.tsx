"use client"

import { useState, useEffect, useCallback } from "react"

interface CatalogoItem {
  id: string
  tipo: string
  valor: string
  descripcion: string | null
  activo: boolean
}

const CATALOGO_TYPES = [
  { tipo: "TIPO_ARTICULO", label: "Tipo de artículo" },
  { tipo: "SECCION", label: "Sección" },
  { tipo: "FAMILIA", label: "Familia" },
  { tipo: "SUBFAMILIA", label: "Subfamilia" },
  { tipo: "UNIDAD_MEDIDA", label: "Unidad de medida" },
  { tipo: "SI_NO", label: "Sí / No" },
  { tipo: "VALORACION", label: "Método valoración" },
  { tipo: "METODO_PRECIO", label: "Método de precio" },
  { tipo: "CLASE_ABC", label: "Clase ABC" },
  { tipo: "UBICACION", label: "Ubicación" },
  { tipo: "CONSERVACION", label: "Conservación" },
  { tipo: "ESTADO", label: "Estado" },
  { tipo: "CODIGO_IVA", label: "Código IVA" },
  { tipo: "ALERGENO", label: "Alérgeno" },
  { tipo: "PROVEEDOR", label: "Proveedor" },
]

export default function CatalogoManager() {
  const [selectedTipo, setSelectedTipo] = useState(CATALOGO_TYPES[0].tipo)
  const [items, setItems] = useState<CatalogoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newValor, setNewValor] = useState("")
  const [newDescripcion, setNewDescripcion] = useState("")
  const [error, setError] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventario/catalogos?tipo=${encodeURIComponent(selectedTipo)}`)
      if (res.ok) {
        setItems(await res.json())
      }
    } catch {
      setError("Error al cargar los catálogos")
    } finally {
      setLoading(false)
    }
  }, [selectedTipo])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setShowAdd(false)
    setNewValor("")
    setNewDescripcion("")
    setError(null)
  }, [selectedTipo])

  useEffect(() => {
    loadItems()
  }, [loadItems])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleAdd() {
    if (!newValor.trim()) {
      setError("El valor es obligatorio")
      return
    }
    setError(null)
    try {
      const res = await fetch("/api/inventario/catalogos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: selectedTipo, valor: newValor.trim(), descripcion: newDescripcion.trim() || null }),
      })
      if (!res.ok) {
        const result = await res.json()
        setError(result.error)
        return
      }
      setNewValor("")
      setNewDescripcion("")
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
          body: JSON.stringify({ activo: true }),
        })
      }
      loadItems()
    } catch {
      setError("Error al actualizar el catálogo")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CATALOGO_TYPES.map((ct) => (
          <button
            key={ct.tipo}
            onClick={() => setSelectedTipo(ct.tipo)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              selectedTipo === ct.tipo
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

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {items.length} valor{items.length !== 1 ? "es" : ""} en <span className="font-medium">{selectedTipo}</span>
        </p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          {showAdd ? "Cancelar" : "+ Añadir valor"}
        </button>
      </div>

      {showAdd && (
        <div className="flex gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
          <input
            type="text"
            value={newValor}
            onChange={(e) => setNewValor(e.target.value)}
            placeholder="Valor (ej: NuevoTipo)"
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="text"
            value={newDescripcion}
            onChange={(e) => setNewDescripcion(e.target.value)}
            placeholder="Descripción (opcional)"
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleAdd}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
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
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500">
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className={!item.activo ? "opacity-50" : ""}>
                  <td className="px-3 py-2 font-mono text-xs text-gray-900">{item.valor}</td>
                  <td className="px-3 py-2 text-gray-600">{item.descripcion || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.activo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}>
                      {item.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleToggleActive(item.id, item.activo)}
                      className={`text-xs font-medium ${item.activo ? "text-red-600 hover:text-red-800" : "text-green-600 hover:text-green-800"}`}
                    >
                      {item.activo ? "Desactivar" : "Reactivar"}
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
