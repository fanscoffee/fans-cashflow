"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import AppHeader from "@/components/app-header"

interface Expense {
  id: string
  proveedor: string
  importe: number
}

interface Shift {
  id: string
  date: string
  turno: string
  status: string
  efectivo: number
  caixa: number
  santander: number
  fondoInicial: number
  fondoFinal: number
  expenses: Expense[]
  createdAt: string
  createdBy?: { name: string | null; email: string }
}

const PAGE_SIZE = 10

export default function TurnosPage() {
  const { status } = useSession()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [filterTurno, setFilterTurno] = useState<string>("todos")
  const [filterStatus, setFilterStatus] = useState<string>("todos")
  const [filterPersona, setFilterPersona] = useState("")
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (status !== "authenticated") return
    let cancelled = false
    fetch("/api/shifts")
      .then((r) => r.json())
      .then((data) => { if (!cancelled) { setShifts(data); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [status])

  const filtered = useMemo(() => {
    const lowerPersona = filterPersona.toLowerCase()
    return shifts.filter((s) => {
      if (dateFrom && s.date < dateFrom) return false
      if (dateTo && s.date > dateTo) return false
      if (filterTurno !== "todos" && s.turno !== filterTurno) return false
      if (filterStatus !== "todos" && s.status !== filterStatus) return false
      if (lowerPersona) {
        const creator = (s.createdBy?.name || s.createdBy?.email || "").toLowerCase()
        if (!creator.includes(lowerPersona)) return false
      }
      return true
    })
  }, [shifts, dateFrom, dateTo, filterTurno, filterStatus, filterPersona])

  const visibleCount = page * PAGE_SIZE
  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  // Reset page when filters change
  const resetFilters = () => {
    setDateFrom("")
    setDateTo("")
    setFilterTurno("todos")
    setFilterStatus("todos")
    setFilterPersona("")
    setPage(1)
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Fans Cashflow"
        subtitle="Historial de Turnos"
      />

      <main className="mx-auto max-w-5xl px-4 py-6">
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Historial de Turnos</h2>

          {/* Filters */}
          <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-4">
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
              <div className="min-w-0 sm:min-w-[140px]">
                <label className="block text-xs font-medium text-gray-600">Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="min-w-0 sm:min-w-[140px]">
                <label className="block text-xs font-medium text-gray-600">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="min-w-0 sm:min-w-[100px]">
                <label className="block text-xs font-medium text-gray-600">Turno</label>
                <select
                  value={filterTurno}
                  onChange={(e) => { setFilterTurno(e.target.value); setPage(1) }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="todos">Todos</option>
                  <option value="mañana">Mañana</option>
                  <option value="tarde">Tarde</option>
                </select>
              </div>
              <div className="min-w-0 sm:min-w-[100px]">
                <label className="block text-xs font-medium text-gray-600">Estado</label>
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="todos">Todos</option>
                  <option value="ABIERTO">Abierto</option>
                  <option value="CERRADO">Cerrado</option>
                </select>
              </div>
              <div className="col-span-2 min-w-0 sm:col-span-1 sm:min-w-[180px]">
                <label className="block text-xs font-medium text-gray-600">Persona</label>
                <input
                  type="text"
                  value={filterPersona}
                  onChange={(e) => { setFilterPersona(e.target.value); setPage(1) }}
                  placeholder="Nombre o email..."
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={resetFilters}
                className="col-span-2 w-full rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 sm:col-span-1 sm:w-auto"
              >
                Limpiar
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500">
              {shifts.length === 0 ? "No hay turnos registrados." : "No hay turnos que coincidan con los filtros."}
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-gray-500">Mostrando {visible.length} de {filtered.length} turnos</p>
              <div className="space-y-3">
                {visible.map((shift) => {
                  const totalExpenses = shift.expenses.reduce((sum, e) => sum + Number(e.importe), 0)
                  return (
                    <div key={shift.id} className="rounded-md border border-gray-100 p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-gray-900">
                            {new Date(shift.date).toLocaleDateString("es-ES")} — {shift.turno}
                          </p>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${shift.status === "ABIERTO" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                            {shift.status === "ABIERTO" ? "Abierto" : "Cerrado"}
                          </span>
                          {shift.createdBy && (
                            <span className="text-xs text-gray-500">
                              — {shift.createdBy.name || shift.createdBy.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                        <div>
                          <span className="text-gray-500">F. Inicial:</span>{" "}
                          <span className="font-medium text-gray-900">{Number(shift.fondoInicial).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">F. Final:</span>{" "}
                          <span className="font-medium text-gray-900">{Number(shift.fondoFinal).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Efectivo:</span>{" "}
                          <span className="font-medium text-gray-900">{Number(shift.efectivo).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Caixa:</span>{" "}
                          <span className="font-medium text-gray-900">{Number(shift.caixa).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Santander:</span>{" "}
                          <span className="font-medium text-gray-900">{Number(shift.santander).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Gastos:</span>{" "}
                          <span className="font-medium text-gray-900">{totalExpenses.toFixed(2)}</span>
                        </div>
                      </div>
                      {shift.expenses.length > 0 && (
                        <div className="mt-2 border-t pt-2">
                          <div className="space-y-1">
                            {shift.expenses.map((expense) => (
                              <div key={expense.id} className="flex justify-between text-xs">
                                <span className="text-gray-600">{expense.proveedor}</span>
                                <span className="font-medium text-gray-900">{Number(expense.importe).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {hasMore && (
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="mt-4 w-full rounded-md border border-gray-300 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Mostrar más ({filtered.length - visibleCount} restantes)
                </button>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}
