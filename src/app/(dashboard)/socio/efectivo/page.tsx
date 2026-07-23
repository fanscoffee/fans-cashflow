"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import AppHeader from "@/components/app-header"

interface CashTracking {
  id: string
  destination: string
  createdBy?: { name: string | null; email: string }
}

interface Shift {
  id: string
  date: string
  turno: string
  status: string
  efectivo: number
  cashTracking: CashTracking | null
  createdBy?: { name: string | null; email: string }
}

import { downloadCSV } from "@/lib/csv"
import { MONTH_NAMES, DESTINATION_LABELS, DESTINATION_KEYS } from "@/lib/constants"
import { toFixed } from "@/lib/money"

export default function EfectivoPage() {
  const { data: session, status } = useSession()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [initialized] = useState(true)

  useEffect(() => {
    if (status !== "authenticated" || !initialized) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/cash-tracking?month=${selectedMonth}&year=${selectedYear}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setShifts(data)
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [status, selectedMonth, selectedYear, initialized])

  async function handleDestinationChange(shiftId: string, destination: string) {
    setSaving(shiftId)
    try {
      const res = await fetch("/api/cash-tracking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId, destination }),
      })
      if (res.ok) {
        const updated = await res.json()
        setShifts((prev) =>
          prev.map((s) =>
            s.id === shiftId
              ? { ...s, cashTracking: { id: updated.id, destination: updated.destination, createdBy: { name: session?.user?.name || null, email: session?.user?.email || "" } } }
              : s
          )
        )
      }
    } catch {
      // ignore
    } finally {
      setSaving(null)
    }
  }

  function handleExport() {
    const data = shifts.map((s) => ({
      Fecha: new Date(s.date).toLocaleDateString("es-ES"),
      Turno: s.turno,
      Efectivo: toFixed(s.efectivo),
      Destino: s.cashTracking ? DESTINATION_LABELS[s.cashTracking.destination] || s.cashTracking.destination : "Sin asignar",
      AsignadoPor: s.cashTracking?.createdBy?.name || s.cashTracking?.createdBy?.email || "",
      CreadoPor: s.createdBy?.name || s.createdBy?.email || "",
    }))
    const filename = `efectivo-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.csv`
    downloadCSV(data, filename)
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="Fans Cashflow" subtitle="Tracking de Efectivo" />

      <main className="mx-auto max-w-5xl px-4 py-6">
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Efectivo por Turno</h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {[selectedYear, selectedYear - 1, selectedYear - 2].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                onClick={handleExport}
                disabled={shifts.length === 0}
                className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Exportar
              </button>
            </div>
          </div>

          {shifts.length === 0 ? (
            <p className="text-sm text-gray-500">No hay turnos para este período.</p>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="space-y-2 sm:hidden">
                {shifts.map((shift) => (
                  <div key={shift.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{new Date(shift.date).toLocaleDateString("es-ES")}</span>
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${shift.turno === "mañana" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                          {shift.turno}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">{toFixed(shift.efectivo)} €</span>
                    </div>
                    <div className="flex gap-2">
                        {DESTINATION_KEYS.map((dest) => (
                        <label key={dest} className={`flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                          shift.cashTracking?.destination === dest
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        } ${saving === shift.id ? "pointer-events-none opacity-50" : ""}`}>
                          <input
                            type="radio"
                            name={`mob-dest-${shift.id}`}
                            checked={shift.cashTracking?.destination === dest}
                            disabled={saving === shift.id}
                            onChange={() => handleDestinationChange(shift.id, dest)}
                            className="sr-only"
                          />
                          {DESTINATION_LABELS[dest]}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs font-medium text-gray-500">
                      <th className="pb-2">Fecha</th>
                      <th className="pb-2">Turno</th>
                      <th className="pb-2 text-right">Efectivo</th>
                      <th className="pb-2 text-center">Depósito</th>
                      <th className="pb-2 text-center">Ingreso en fondo</th>
                      <th className="pb-2 text-center">Guardado</th>
                      <th className="pb-2 text-center">Fans</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {shifts.map((shift) => (
                      <tr key={shift.id} className="hover:bg-gray-50">
                        <td className="py-3 text-gray-900">
                          {new Date(shift.date).toLocaleDateString("es-ES")}
                        </td>
                        <td className="py-3 text-gray-900">{shift.turno}</td>
                        <td className="py-3 text-right font-medium text-gray-900">
                          {toFixed(shift.efectivo)} €
                        </td>
                    {DESTINATION_KEYS.map((dest) => (
                          <td key={dest} className="py-3 text-center">
                            <input
                              type="radio"
                              name={`desk-dest-${shift.id}`}
                              checked={shift.cashTracking?.destination === dest}
                              disabled={saving === shift.id}
                              onChange={() => handleDestinationChange(shift.id, dest)}
                              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
