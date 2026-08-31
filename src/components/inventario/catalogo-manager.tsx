"use client"

import { useState, useEffect, useCallback } from "react"

interface CatalogoItem {
  id: string
  tipo: string
  valor: string
  descripcion: string | null
  prefijoCodigo: string | null
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
  const [newPrefijoCodigo, setNewPrefijoCodigo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
    setNewPrefijoCodigo("")
    setError(null)
    setSuccess(null)
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
    const prefijoCodigo = newPrefijoCodigo.trim().toUpperCase()
    if (selectedTipo === "FAMILIA" && !/^[A-Z]{3}$/.test(prefijoCodigo)) {
      setError("El prefijo de familia debe tener 3 letras mayúsculas")
      return
    }
    setError(null)
    try {
      const res = await fetch("/api/inventario/catalogos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: selectedTipo,
          valor: newValor.trim(),
          descripcion: newDescripcion.trim() || null,
          ...(selectedTipo === "FAMILIA" ? { prefijoCodigo } : {}),
        }),
      })
      if (!res.ok) {
        const result = await res.json()
        setError(result.error)
        return
      }
      setNewValor("")
      setNewDescripcion("")
      setNewPrefijoCodigo("")
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

  async function handleDeleteCatalogo(id: string, valor: string) {
    const catalogoLabel = CATALOGO_TYPES.find((catalogo) => catalogo.tipo === selectedTipo)?.label || selectedTipo
    if (!confirm(`¿Eliminar "${valor}" del catálogo "${catalogoLabel}"? Esta acción no se puede deshacer.`)) return

    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/inventario/catalogos/${id}?permanente=true`, { method: "DELETE" })
      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al eliminar el valor del catálogo")
        return
      }

      setSuccess(`"${valor}" eliminado del catálogo "${catalogoLabel}"`)
      await loadItems()
    } catch {
      setError("Error al conectar con el servidor")
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
      {success && (
        <div className="rounded-md bg-green-50 p-2 text-xs text-green-600">{success}</div>
      )}

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
          {items.length} valor{items.length !== 1 ? "es" : ""} en <span className="font-medium">{selectedTipo}</span>
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
            value={newValor}
            onChange={(e) => setNewValor(e.target.value)}
            placeholder="Valor (ej: NuevoTipo)"
            className="min-w-0 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:flex-1 sm:py-1.5"
          />
          {selectedTipo === "FAMILIA" && (
            <input
              type="text"
              value={newPrefijoCodigo}
              onChange={(e) => setNewPrefijoCodigo(e.target.value.toUpperCase())}
              placeholder="Prefijo (HAR)"
              maxLength={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-32 sm:py-1.5"
            />
          )}
          <input
            type="text"
            value={newDescripcion}
            onChange={(e) => setNewDescripcion(e.target.value)}
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
                {selectedTipo === "FAMILIA" && <th className="px-3 py-2">Prefijo</th>}
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className={!item.activo ? "opacity-50" : ""}>
                  <td className="px-3 py-2 font-mono text-xs text-gray-900">{item.valor}</td>
                  {selectedTipo === "FAMILIA" && <td className="px-3 py-2 font-mono text-xs text-gray-900">{item.prefijoCodigo || "—"}</td>}
                  <td className="px-3 py-2 text-gray-600">{item.descripcion || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.activo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}>
                      {item.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-3">
                      <button
                        onClick={() => handleToggleActive(item.id, item.activo)}
                        className={`text-xs font-medium ${item.activo ? "text-red-600 hover:text-red-800" : "text-green-600 hover:text-green-800"}`}
                      >
                        {item.activo ? "Desactivar" : "Reactivar"}
                      </button>
                      <button
                        onClick={() => handleDeleteCatalogo(item.id, item.valor)}
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
