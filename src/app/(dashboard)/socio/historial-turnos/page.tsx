"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import AppHeader from "@/components/app-header"
import { toN } from "@/lib/money"
import type { CurrentExpense } from "@/types/shift"

interface Expense {
  id: string
  supplier: string
  amount: number
}

interface Shift {
  id: string
  date: string
  shift: string
  status: string
  cash: number
  caixaBankAmount: number
  santanderAmount: number
  openingFund: number
  closingFund: number
  expenses: Expense[]
  currentExpenses?: CurrentExpense[]
  createdAt: string
  createdBy?: { name: string | null; email: string }
}

const PAGE_SIZE = 10

export default function HistorialShiftsPage() {
  const { status } = useSession()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [filterShift, setFilterShift] = useState<string>("todos")
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
      if (filterShift !== "todos" && s.shift !== filterShift) return false
      if (filterStatus !== "todos" && s.status !== filterStatus) return false
      if (lowerPersona) {
        const creator = (s.createdBy?.name || s.createdBy?.email || "").toLowerCase()
        if (!creator.includes(lowerPersona)) return false
      }
      return true
    })
  }, [shifts, dateFrom, dateTo, filterShift, filterStatus, filterPersona])

  const visibleCount = page * PAGE_SIZE
  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  // Reset page when filters change
  const resetFilters = () => {
    setDateFrom("")
    setDateTo("")
    setFilterShift("todos")
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
        title="Historial de Turnos"
        subtitle="Fans Cashflow"
      />

      <main className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:pb-6">
        <section className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Historial de Turnos</h2>

          {/* Filters */}
          <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-4">
            <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
              <div className="min-w-0 sm:min-w-[140px]">
                <label className="block text-xs font-medium text-gray-600">Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                  className="mt-1 block w-full min-w-0 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="min-w-0 sm:min-w-[140px]">
                <label className="block text-xs font-medium text-gray-600">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                  className="mt-1 block w-full min-w-0 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="min-w-0 sm:min-w-[100px]">
                <label className="block text-xs font-medium text-gray-600">Turno</label>
                <select
                  value={filterShift}
                  onChange={(e) => { setFilterShift(e.target.value); setPage(1) }}
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
              <div className="min-w-0 sm:min-w-[180px]">
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
                className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 sm:w-auto sm:py-1.5"
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
              <div className="space-y-4">
                {(() => {
                  const groups: Record<string, Shift[]> = {}
                  for (const shift of visible) {
                    const day = shift.date.slice(0, 10)
                    if (!groups[day]) groups[day] = []
                    groups[day].push(shift)
                  }
                  return Object.entries(groups).map(([day, dayShifts]) => {
                    dayShifts.sort((a) => a.shift === "mañana" ? -1 : 1)
                    const dailyRevenue = dayShifts.reduce(
                      (sum, s) => sum + toN(s.cash) + toN(s.caixaBankAmount) + toN(s.santanderAmount),
                      0
                    )
                    return (
                      <div key={day} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="mb-3 flex flex-col gap-2 border-b border-gray-200 pb-2 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="break-words font-semibold text-gray-900 [overflow-wrap:anywhere]">
                            {new Date(day + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                          </h3>
                          <span className="rounded-md bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
                            {dailyRevenue.toFixed(2)} €
                          </span>
                        </div>
                        <div className="space-y-3">
                          {dayShifts.map((shift) => {
                            const totalExpenses = shift.expenses.reduce((sum, e) => sum + toN(e.amount), 0)
                            const currentExpenses = shift.currentExpenses || []
                            const totalCurrentExpenses = currentExpenses.reduce((sum, expense) => sum + toN(expense.amount), 0)
                            const totalPorShift = toN(shift.cash) + toN(shift.caixaBankAmount) + toN(shift.santanderAmount)
                            return (
                              <div key={shift.id} className="rounded-md border border-gray-100 bg-white p-4">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${shift.shift === "mañana" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                                      {shift.shift}
                                    </span>
                                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${shift.status === "ABIERTO" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                                      {shift.status === "ABIERTO" ? "Abierto" : "Cerrado"}
                                    </span>
                                    {shift.createdBy && (
                                      <span className="text-xs text-gray-500">
                                        — {shift.createdBy.name || shift.createdBy.email}
                                      </span>
                                    )}
                                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                                      {totalPorShift.toFixed(2)} €
                                    </span>
                                  </div>
                                </div>
                        <div className="mt-2 grid grid-cols-1 gap-2 text-sm min-[420px]:grid-cols-2 md:grid-cols-4">
                                  <div>
                                    <span className="text-gray-500">F. Inicial:</span>{" "}
                                     <span className="font-medium text-gray-900">{toN(shift.openingFund).toFixed(2)}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">F. Final:</span>{" "}
                                    <span className="font-medium text-gray-900">{toN(shift.closingFund).toFixed(2)}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Efectivo:</span>{" "}
                                    <span className="font-medium text-gray-900">{toN(shift.cash).toFixed(2)}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Caixa:</span>{" "}
                                    <span className="font-medium text-gray-900">{toN(shift.caixaBankAmount).toFixed(2)}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Santander:</span>{" "}
                                    <span className="font-medium text-gray-900">{toN(shift.santanderAmount).toFixed(2)}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Gastos:</span>{" "}
                                    <span className="font-medium text-gray-900">{totalExpenses.toFixed(2)}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Gastos corrientes:</span>{" "}
                                    <span className="font-medium text-gray-900">{totalCurrentExpenses.toFixed(2)}</span>
                                  </div>
                                </div>
                                {shift.expenses.length > 0 && (
                                  <div className="mt-2 border-t pt-2">
                                    <div className="space-y-1">
                                      {shift.expenses.map((expense) => (
                                        <div key={expense.id} className="flex justify-between text-xs">
                                      <span className="min-w-0 break-words text-gray-600 [overflow-wrap:anywhere]">{expense.supplier}</span>
                                      <span className="shrink-0 font-medium text-gray-900">{toN(expense.amount).toFixed(2)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {currentExpenses.length > 0 && (
                                  <div className="mt-2 border-t border-blue-100 pt-2">
                                    <p className="mb-1 text-xs font-medium text-blue-800">Gastos corrientes · seguimiento</p>
                                    <div className="space-y-1">
                                      {currentExpenses.map((expense) => (
                                        <div key={expense.id} className="flex justify-between gap-3 text-xs">
                                          <span className="min-w-0 break-words text-gray-700 [overflow-wrap:anywhere]">{expense.concept} · {expense.category.code} · {expense.status === "PENDIENTE_AUTORIZACION" ? "Pendiente de autorización" : expense.status} · {expense.requester.name || expense.requester.email}</span>
                                          <span className="shrink-0 whitespace-nowrap font-medium text-gray-900">{toN(expense.amount).toFixed(2)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                })()}
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
