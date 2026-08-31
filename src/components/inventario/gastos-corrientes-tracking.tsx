"use client"

import { useCallback, useEffect, useState } from "react"

interface GastoCorriente {
  id: string
  entidad: "OBRADOR" | "CAFETERIA"
  concepto: string
  fechaDevengo: string
  importe: number | string
  justificante: string
  estado: string
  categoria: { codigo: string; nombre: string }
  acreedor: { nombre: string } | null
  solicitante: { name: string | null; email: string }
  shift: { date: string; turno: string } | null
}

function euros(value: number | string) {
  return `${Number(value || 0).toFixed(2)} €`
}

function statusClass(status: string) {
  if (status === "AUTORIZADO") return "bg-green-100 text-green-800"
  if (status === "PENDIENTE_AUTORIZACION") return "bg-amber-100 text-amber-800"
  if (status === "RECHAZADO" || status === "ANULADO") return "bg-red-100 text-red-800"
  if (status === "PAGADO") return "bg-blue-100 text-blue-800"
  return "bg-gray-100 text-gray-700"
}

function statusLabel(status: string) {
  return status === "PENDIENTE_AUTORIZACION" ? "Pendiente de autorización" : status
}

export default function GastosCorrientesTracking({ canAccess }: { canAccess: boolean }) {
  const [gastos, setGastos] = useState<GastoCorriente[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const loadGastos = useCallback(async () => {
    if (!canAccess) return
    setLoading(true)
    try {
      const response = await fetch("/api/pagos/gastos")
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Error al cargar gastos corrientes")
      setGastos(data || [])
      setError("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error al cargar gastos corrientes")
    } finally {
      setLoading(false)
    }
  }, [canAccess])

  async function deleteGasto(gasto: GastoCorriente) {
    if (!confirm(`¿Eliminar el gasto "${gasto.concepto}"? Se anulará y dejará de aparecer en el seguimiento.`)) return

    setDeletingId(gasto.id)
    setError("")
    setSuccess("")
    try {
      const response = await fetch(`/api/pagos/gastos/${gasto.id}`, { method: "DELETE" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar el gasto corriente")
      setGastos((current) => current.filter((item) => item.id !== gasto.id))
      setSuccess("Gasto corriente eliminado correctamente")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo eliminar el gasto corriente")
    } finally {
      setDeletingId(null)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { void loadGastos() }, [loadGastos])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!canAccess) return null

  const lowerSearch = search.trim().toLowerCase()
  const visibleGastos = gastos.filter((gasto) => {
    if (!lowerSearch) return true
    const solicitante = gasto.solicitante.name || gasto.solicitante.email
    return [gasto.concepto, gasto.categoria.nombre, gasto.categoria.codigo, gasto.acreedor?.nombre, solicitante, gasto.shift?.turno]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(lowerSearch))
  })

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Seguimiento de gastos corrientes</h2>
          <p className="text-xs text-gray-500">Gastos registrados desde turnos abiertos; aquí puedes seguir su estado y origen.</p>
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar concepto, persona..."
          className="min-w-56 rounded-md border px-3 py-2 text-sm text-gray-900"
        />
      </div>
      {error && <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="mb-3 rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Cargando gastos corrientes...</p>
      ) : visibleGastos.length === 0 ? (
        <p className="text-sm text-gray-500">No hay gastos corrientes que mostrar.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Entidad</th>
                <th className="px-3 py-2">Concepto</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2">Importe</th>
                <th className="px-3 py-2">Solicitante</th>
                <th className="px-3 py-2">Turno</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleGastos.map((gasto) => (
                <tr key={gasto.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{new Date(gasto.fechaDevengo).toLocaleDateString("es-ES")}</td>
                  <td className="px-3 py-2 text-gray-600">{gasto.entidad}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{gasto.concepto}</td>
                  <td className="px-3 py-2 text-gray-600">{gasto.categoria.codigo} · {gasto.categoria.nombre}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">{euros(gasto.importe)}</td>
                  <td className="px-3 py-2 text-gray-600">{gasto.solicitante.name || gasto.solicitante.email}</td>
                  <td className="px-3 py-2 text-gray-600">{gasto.shift ? `${gasto.shift.turno} · ${new Date(gasto.shift.date).toLocaleDateString("es-ES")}` : "Sin turno"}</td>
                  <td className="px-3 py-2"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(gasto.estado)}`}>{statusLabel(gasto.estado)}</span></td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => void deleteGasto(gasto)}
                      disabled={deletingId === gasto.id}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === gasto.id ? "Eliminando..." : "Eliminar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
